'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Clapperboard,
  Edit3,
  Eye,
  ExternalLink,
  Heart,
  ImageIcon,
  LayoutGrid,
  Loader2,
  MessageCircle,
  Play,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/system/feedback/ToastProvider';
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

export default function ManageCommunityClient({
  isId,
  mode = 'all',
}: {
  isId: boolean;
  mode?: ManageSocialMode;
}) {
  const locale = isId ? 'id' : 'en';
  const { authFetch, isAuthenticated, loading: authLoading } = useAuth();
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<ManageTab>(
    mode === 'reels' ? 'reels' : 'community',
  );
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failedTabs, setFailedTabs] = useState<ManageTab[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingThread, setEditingThread] = useState<EditingThread | null>(
    null,
  );
  const [editingReel, setEditingReel] = useState<EditingReel | null>(null);

  const copy = useMemo(
    () => ({
      title:
        mode === 'community'
          ? isId
            ? 'Kelola postingan komunitas'
            : 'Manage community posts'
          : mode === 'reels'
            ? isId
              ? 'Kelola reels'
              : 'Manage reels'
            : isId
              ? 'Kelola konten sosial'
              : 'Manage social content',
      subtitle:
        mode === 'community'
          ? isId
            ? 'Edit atau hapus thread, pertanyaan, dan diskusi komunitas yang kamu buat.'
            : 'Edit or delete threads, questions, and community discussions you created.'
          : mode === 'reels'
            ? isId
              ? 'Edit caption, tag, dan arsipkan reels yang kamu buat.'
              : 'Edit captions, tags, and archive reels you created.'
            : isId
              ? 'Edit atau hapus postingan komunitas dan reels yang kamu buat.'
              : 'Edit or delete community posts and reels you created.',
      community: isId ? 'Postingan komunitas' : 'Community posts',
      reels: isId ? 'Reels saya' : 'My reels',
      listings: isId ? 'Listing' : 'Listings',
      contentNavigator: isId ? 'Pilih jenis konten' : 'Choose content type',
      refresh: isId ? 'Muat ulang' : 'Refresh',
      loading: isId ? 'Memuat konten...' : 'Loading content...',
      signIn: isId
        ? 'Masuk dulu untuk melihat konten yang bisa kamu kelola.'
        : 'Sign in to see content you can manage.',
      emptyCommunity: isId
        ? 'Belum ada postingan komunitas yang kamu buat.'
        : 'No community posts from you yet.',
      emptyReels: isId ? 'Belum ada reels yang kamu buat.' : 'No reels yet.',
      edit: isId ? 'Edit' : 'Edit',
      save: isId ? 'Simpan' : 'Save',
      cancel: isId ? 'Batal' : 'Cancel',
      delete: isId ? 'Hapus' : 'Delete',
      archive: isId ? 'Arsipkan' : 'Archive',
      open: isId ? 'Buka' : 'Open',
      failed: isId ? 'Aksi gagal. Coba lagi.' : 'Action failed. Try again.',
      loadFailed: isId
        ? 'Data milik saya belum bisa dimuat.'
        : 'Could not load your content.',
      partialLoadFailed: isId
        ? 'Sebagian data belum bisa dimuat. Konten lain tetap bisa dikelola.'
        : 'Some data could not be loaded. Other content remains manageable.',
      loadHint: isId
        ? 'Cek sesi login atau koneksi community service, lalu muat ulang.'
        : 'Check your login session or community service connection, then refresh.',
      saved: isId ? 'Perubahan disimpan.' : 'Changes saved.',
      deleted: isId ? 'Konten dihapus.' : 'Content deleted.',
      archived: isId ? 'Reels diarsipkan.' : 'Reel archived.',
      totalEngagement: isId ? 'Interaksi' : 'Engagement',
      manageable: isId ? 'Bisa dikelola' : 'Manageable',
    }),
    [isId, mode],
  );

  useEffect(() => {
    if (mode === 'reels') setActiveTab('reels');
    if (mode === 'community') setActiveTab('community');
  }, [mode]);

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
      const payload = await readJson<ForumPostsResponse>(response);
      const root = Array.isArray(payload.data) ? payload.data[0] : null;
      setEditingThread({
        id: thread.id,
        rootPostId: root?.id || null,
        title: thread.title,
        content: root?.content || '',
        imageUrls: root?.imageUrls || thread.imageUrls || [],
      });
    } catch {
      notify({ title: copy.failed, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const saveThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingThread) return;
    setBusyId(editingThread.id);
    try {
      const response = await authFetch(
        `/api/forum/threads/${encodeURIComponent(editingThread.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editingThread.title,
            content: editingThread.content,
            imageUrls: editingThread.imageUrls,
          }),
        },
      );
      if (!response.ok) throw new Error('failed');
      setEditingThread(null);
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
    if (!editingReel) return;
    setBusyId(editingReel.id);
    try {
      const response = await authFetch(
        `/api/reels/${encodeURIComponent(editingReel.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingReel),
        },
      );
      if (!response.ok) throw new Error('failed');
      setEditingReel(null);
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
        {
          method: 'DELETE',
        },
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

  const totalCommunityEngagement = threads.reduce(
    (total, thread) => total + thread.replyCount + thread.views,
    0,
  );
  const totalReelEngagement = reels.reduce(
    (total, reel) =>
      total + reel.likesCount + reel.commentsCount + reel.sharesCount,
    0,
  );
  const summaryItems =
    activeTab === 'community'
      ? [
          {
            label: copy.manageable,
            value: threads.length,
            hint: copy.community,
          },
          {
            label: copy.totalEngagement,
            value: totalCommunityEngagement,
            hint: isId ? 'dilihat + balasan' : 'views + replies',
          },
        ]
      : [
          {
            label: copy.manageable,
            value: reels.length,
            hint: copy.reels,
          },
          {
            label: copy.totalEngagement,
            value: totalReelEngagement,
            hint: isId
              ? 'suka + komentar + dibagikan'
              : 'likes + comments + shares',
          },
        ];
  const activeTabFailed = failedTabs.includes(activeTab);

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="page-shell page-rhythm py-8">
        <section className="ui-panel ui-hero-panel rounded-3xl p-6">
          <p className="ui-kicker">
            <AlertCircle className="h-3.5 w-3.5" />
            {copy.title}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[color:var(--app-text)]">
            {copy.signIn}
          </h1>
          <Link
            href="/login"
            className="ui-button-primary mt-5 inline-flex items-center gap-2 px-4 text-sm font-semibold"
          >
            <ArrowRight className="h-4 w-4" />
            {isId ? 'Masuk' : 'Sign in'}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell page-rhythm py-8">
      <section className="ui-panel ui-hero-panel rounded-3xl p-6">
        <p className="ui-kicker">
          <Edit3 className="h-3.5 w-3.5" />
          {mode === 'reels'
            ? isId
              ? 'Studio reels'
              : 'Reels management'
            : mode === 'community'
              ? isId
                ? 'Ruang komunitas'
                : 'Community post management'
              : isId
                ? 'Studio konten'
                : 'Post management'}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[color:var(--app-text)]">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {copy.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/manage"
              className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold"
            >
              <ArrowRight className="h-4 w-4" />
              {isId ? 'Pusat kelola' : 'Manage hub'}
            </Link>
            {mode !== 'reels' ? (
              <Link
                href="/community?compose=post"
                className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                {isId ? 'Buat postingan' : 'New post'}
              </Link>
            ) : null}
            {mode !== 'community' ? (
              <Link
                href="/reels?upload=1"
                className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold"
              >
                <Clapperboard className="h-4 w-4" />
                {isId ? 'Buat reels' : 'New reel'}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <ManageContentNavigator
        isId={isId}
        activeTab={activeTab}
        communityCount={threads.length}
        reelsCount={reels.length}
        label={copy.contentNavigator}
      />

      <section className="ui-panel rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[color:var(--app-text)]">
              {activeTab === 'community' ? copy.community : copy.reels}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
              {activeTab === 'community'
                ? isId
                  ? `${threads.length} postingan ditemukan`
                  : `${threads.length} posts found`
                : isId
                  ? `${reels.length} reels ditemukan`
                  : `${reels.length} reels found`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadContent()}
            disabled={loading}
            className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {copy.refresh}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {summaryItems.map(item => (
            <div
              key={item.label}
              className="rounded-2xl border border-[color:var(--app-border)] bg-white p-3 dark:bg-[color:var(--app-surface)]"
            >
              <p className="text-xs font-semibold text-[color:var(--app-text-soft)]">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--app-text)]">
                {metric(item.value)}
              </p>
              <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                {item.hint}
              </p>
            </div>
          ))}
        </div>

        {loading ? (
          <div
            role="status"
            className="mt-6 flex items-center gap-2 text-sm text-[color:var(--app-text-soft)]"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.loading}
          </div>
        ) : null}

        {!loading && loadError ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">{loadError}</p>
                <p className="mt-1 leading-6">{copy.loadHint}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !activeTabFailed && activeTab === 'community' ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {threads.length === 0 ? (
              <EmptyState
                text={copy.emptyCommunity}
                href="/community?compose=post"
                label={isId ? 'Buat postingan' : 'Create post'}
              />
            ) : null}
            {threads.map(thread => (
              <article
                key={thread.id}
                className="group overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[color:var(--app-surface)]"
              >
                <VisualPreview
                  title={thread.title}
                  source={thread.imageUrls?.find(Boolean)}
                  kind="community"
                  status={statusLabel(thread.status, isId)}
                  statusTone={statusTone(thread.status)}
                />
                <div className="p-4">
                  {editingThread?.id === thread.id ? (
                    <form onSubmit={saveThread} className="space-y-4">
                      <LabeledField
                        label={isId ? 'Judul postingan' : 'Post title'}
                      >
                        <input
                          value={editingThread.title}
                          onChange={event =>
                            setEditingThread(current =>
                              current
                                ? { ...current, title: event.target.value }
                                : current,
                            )
                          }
                          required
                          className="min-h-11 w-full rounded-2xl border border-[color:var(--app-border)] bg-transparent px-3 py-2 text-sm font-semibold outline-none focus:border-[color:var(--app-accent)]"
                        />
                      </LabeledField>
                      <LabeledField
                        label={isId ? 'Isi postingan' : 'Post content'}
                      >
                        <textarea
                          value={editingThread.content}
                          onChange={event =>
                            setEditingThread(current =>
                              current
                                ? { ...current, content: event.target.value }
                                : current,
                            )
                          }
                          rows={5}
                          className="w-full rounded-2xl border border-[color:var(--app-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--app-accent)]"
                        />
                      </LabeledField>
                      <EditActions
                        busy={busyId === thread.id}
                        save={copy.save}
                        cancel={copy.cancel}
                        onCancel={() => setEditingThread(null)}
                      />
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {isId ? 'Diskusi komunitas' : 'Community discussion'}
                        </span>
                        <time
                          dateTime={thread.createdAt}
                          className="shrink-0 text-xs text-[color:var(--app-text-soft)]"
                        >
                          {formatDate(thread.createdAt, locale)}
                        </time>
                      </div>
                      <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-bold leading-6 text-[color:var(--app-text)]">
                        {thread.title}
                      </h3>
                      {thread.tags?.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {thread.tags.slice(0, 3).map(tagItem => (
                            <span
                              key={tagItem.slug}
                              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]"
                            >
                              <Tag className="h-3 w-3" />
                              {tagItem.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div
                        className="mt-4 flex flex-wrap gap-2"
                        aria-label={
                          isId ? 'Statistik postingan' : 'Post statistics'
                        }
                      >
                        <MetricBadge
                          icon={Eye}
                          value={thread.views}
                          label={isId ? 'dilihat' : 'views'}
                        />
                        <MetricBadge
                          icon={MessageCircle}
                          value={thread.replyCount}
                          label={isId ? 'balasan' : 'replies'}
                        />
                      </div>
                      <ContentActions
                        title={thread.title}
                        href={`/community?thread=${encodeURIComponent(thread.id)}`}
                        busy={busyId === thread.id}
                        open={copy.open}
                        edit={copy.edit}
                        destructiveLabel={copy.delete}
                        destructiveIcon="delete"
                        onEdit={() => void startThreadEdit(thread)}
                        onDestructive={() => void deleteThread(thread.id)}
                      />
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {!loading && !activeTabFailed && activeTab === 'reels' ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {reels.length === 0 ? (
              <EmptyState
                text={copy.emptyReels}
                href="/reels?upload=1"
                label={isId ? 'Buat reels' : 'Create reel'}
              />
            ) : null}
            {reels.map(reel => (
              <article
                key={reel.id}
                className="group overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[color:var(--app-surface)]"
              >
                <VisualPreview
                  title={reel.title}
                  source={reel.videoSrc || reel.sourceUrl}
                  poster={getImagePoster(reel.sourceUrl, reel.videoSrc)}
                  kind={
                    reel.mediaType === 'image' ? 'reel-image' : 'reel-video'
                  }
                  status={isId ? 'Tayang' : 'Published'}
                />
                <div className="p-4">
                  {editingReel?.id === reel.id ? (
                    <form onSubmit={saveReel} className="space-y-4">
                      <LabeledField label={isId ? 'Judul reels' : 'Reel title'}>
                        <input
                          value={editingReel.title}
                          onChange={event =>
                            setEditingReel(current =>
                              current
                                ? { ...current, title: event.target.value }
                                : current,
                            )
                          }
                          required
                          className="min-h-11 w-full rounded-2xl border border-[color:var(--app-border)] bg-transparent px-3 py-2 text-sm font-semibold outline-none focus:border-[color:var(--app-accent)]"
                        />
                      </LabeledField>
                      <LabeledField label={isId ? 'Tag' : 'Tag'}>
                        <input
                          value={editingReel.tag}
                          onChange={event =>
                            setEditingReel(current =>
                              current
                                ? { ...current, tag: event.target.value }
                                : current,
                            )
                          }
                          className="min-h-11 w-full rounded-2xl border border-[color:var(--app-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--app-accent)]"
                        />
                      </LabeledField>
                      <LabeledField label={isId ? 'Caption' : 'Caption'}>
                        <textarea
                          value={editingReel.caption}
                          onChange={event =>
                            setEditingReel(current =>
                              current
                                ? { ...current, caption: event.target.value }
                                : current,
                            )
                          }
                          rows={4}
                          className="w-full rounded-2xl border border-[color:var(--app-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--app-accent)]"
                        />
                      </LabeledField>
                      <EditActions
                        busy={busyId === reel.id}
                        save={copy.save}
                        cancel={copy.cancel}
                        onCancel={() => setEditingReel(null)}
                      />
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                          <Clapperboard className="h-3.5 w-3.5" />
                          {reel.mediaType === 'image'
                            ? isId
                              ? 'Reel foto'
                              : 'Photo reel'
                            : isId
                              ? 'Reel video'
                              : 'Video reel'}
                        </span>
                        {reel.tag ? (
                          <span className="max-w-[50%] truncate rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                            #{reel.tag.replace(/^#/, '')}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-base font-bold leading-6 text-[color:var(--app-text)]">
                        {reel.title ||
                          (isId ? 'Reels tanpa judul' : 'Untitled reel')}
                      </h3>
                      <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[color:var(--app-text-soft)]">
                        {reel.caption ||
                          (isId
                            ? 'Belum ada caption untuk reels ini.'
                            : 'This reel does not have a caption yet.')}
                      </p>
                      <div
                        className="mt-4 flex flex-wrap gap-2"
                        aria-label={
                          isId ? 'Statistik reels' : 'Reel statistics'
                        }
                      >
                        <MetricBadge
                          icon={Heart}
                          value={reel.likesCount}
                          label={isId ? 'suka' : 'likes'}
                        />
                        <MetricBadge
                          icon={MessageCircle}
                          value={reel.commentsCount}
                          label={isId ? 'komentar' : 'comments'}
                        />
                        <MetricBadge
                          icon={Share2}
                          value={reel.sharesCount}
                          label={isId ? 'dibagikan' : 'shares'}
                        />
                      </div>
                      <ContentActions
                        title={
                          reel.title ||
                          (isId ? 'Reels tanpa judul' : 'Untitled reel')
                        }
                        href={`/reels?reel=${encodeURIComponent(reel.id)}`}
                        busy={busyId === reel.id}
                        open={copy.open}
                        edit={copy.edit}
                        destructiveLabel={copy.archive}
                        destructiveIcon="archive"
                        onEdit={() =>
                          setEditingReel({
                            id: reel.id,
                            title: reel.title,
                            caption: reel.caption,
                            tag: reel.tag,
                          })
                        }
                        onDestructive={() => void archiveReel(reel.id)}
                      />
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function ManageContentNavigator({
  isId,
  activeTab,
  communityCount,
  reelsCount,
  label,
}: {
  isId: boolean;
  activeTab: ManageTab;
  communityCount: number;
  reelsCount: number;
  label: string;
}) {
  const items = [
    {
      id: 'listings',
      href: '/my-listings',
      label: isId ? 'Listing' : 'Listings',
      description: isId ? 'Produk & kebutuhan' : 'Products & requests',
      icon: LayoutGrid,
      count: null,
      active: false,
    },
    {
      id: 'community',
      href: '/manage/community',
      label: isId ? 'Komunitas' : 'Community',
      description: isId ? 'Thread & diskusi' : 'Threads & discussions',
      icon: MessageCircle,
      count: communityCount,
      active: activeTab === 'community',
    },
    {
      id: 'reels',
      href: '/manage/reels',
      label: 'Reels',
      description: isId ? 'Video & foto singkat' : 'Short videos & photos',
      icon: Clapperboard,
      count: reelsCount,
      active: activeTab === 'reels',
    },
  ];

  return (
    <nav aria-label={label} className="ui-panel rounded-3xl p-2 sm:p-3">
      <div className="grid grid-cols-3 gap-2">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'group relative flex min-h-[74px] min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-3 transition sm:min-h-[82px] sm:gap-3 sm:px-2',
                item.active
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : 'border-transparent bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:border-[color:var(--app-border)] hover:bg-white dark:hover:bg-[color:var(--app-surface)]',
              )}
            >
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                  item.active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-[color:var(--app-text-soft)] shadow-sm dark:bg-white/10',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-bold sm:text-sm">
                    {item.label}
                  </span>
                  {item.count !== null ? (
                    <span className="hidden rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold sm:inline dark:bg-white/10">
                      {metric(item.count)}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 hidden truncate text-xs opacity-70 sm:block">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function VisualPreview({
  title,
  source,
  poster,
  kind,
  status,
  statusTone = 'active',
}: {
  title: string;
  source?: string;
  poster?: string;
  kind: 'community' | 'reel-image' | 'reel-video';
  status: string;
  statusTone?: 'active' | 'pending' | 'inactive';
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const isVideo = kind === 'reel-video';
  const isReel = kind !== 'community';

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-cyan-600',
        isReel ? 'aspect-[4/5]' : 'aspect-video',
      )}
    >
      {source && !mediaFailed ? (
        isVideo ? (
          <video
            src={source}
            poster={poster}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            onError={() => setMediaFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          // Arbitrary community media URLs are provided by the API.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source}
            alt=""
            loading="lazy"
            onError={() => setMediaFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        )
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center text-white/90">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
              {isReel ? (
                <Clapperboard className="h-7 w-7" />
              ) : (
                <ImageIcon className="h-7 w-7" />
              )}
            </span>
            <span className="mt-3 block text-xs font-semibold text-white/75">
              {isReel ? 'Reels' : 'Community'}
            </span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/30" />
      <span
        className={cn(
          'absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-sm',
          statusTone === 'active'
            ? 'bg-emerald-500'
            : statusTone === 'pending'
              ? 'bg-amber-500'
              : 'bg-slate-600',
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        {status}
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        {kind === 'community'
          ? 'Post'
          : kind === 'reel-image'
            ? 'Foto'
            : 'Video'}
      </span>
      {isVideo ? (
        <span
          className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-950 shadow-xl"
          aria-hidden="true"
        >
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
      ) : null}
      <p className="absolute inset-x-3 bottom-3 line-clamp-2 text-sm font-bold leading-5 text-white drop-shadow">
        {title}
      </p>
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

function MetricBadge({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
      <Icon className="h-3.5 w-3.5" />
      <span className="font-bold text-[color:var(--app-text)]">
        {metric(value)}
      </span>
      <span>{label}</span>
    </span>
  );
}

function statusLabel(status: string, isId: boolean) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'review') {
    return isId ? 'Ditinjau' : 'In review';
  }
  if (
    normalized === 'blocked' ||
    normalized === 'archived' ||
    normalized === 'inactive'
  ) {
    return isId ? 'Tidak aktif' : 'Inactive';
  }
  return isId ? 'Aktif' : 'Active';
}

function statusTone(status: string): 'active' | 'pending' | 'inactive' {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'review') return 'pending';
  if (
    normalized === 'blocked' ||
    normalized === 'archived' ||
    normalized === 'inactive'
  ) {
    return 'inactive';
  }
  return 'active';
}

function getImagePoster(sourceUrl: string, videoSrc: string) {
  if (!sourceUrl || sourceUrl === videoSrc) return undefined;
  return /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(sourceUrl)
    ? sourceUrl
    : undefined;
}

function EmptyState({
  text,
  href,
  label,
}: {
  text: string;
  href: string;
  label: string;
}) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5 text-sm text-[color:var(--app-text-soft)]">
      <p>{text}</p>
      <Link
        href={href}
        className="ui-button-primary mt-4 inline-flex items-center gap-2 px-4 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" />
        {label}
      </Link>
    </div>
  );
}

function EditActions({
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
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={busy}
        className="ui-button-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {save}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="ui-button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold"
      >
        <X className="h-4 w-4" />
        {cancel}
      </button>
    </div>
  );
}

function ContentActions({
  title,
  href,
  busy,
  open,
  edit,
  destructiveLabel,
  destructiveIcon,
  onEdit,
  onDestructive,
}: {
  title: string;
  href: string;
  busy: boolean;
  open: string;
  edit: string;
  destructiveLabel: string;
  destructiveIcon: 'archive' | 'delete';
  onEdit: () => void;
  onDestructive: () => void;
}) {
  const DestructiveIcon = destructiveIcon === 'archive' ? Archive : Trash2;

  return (
    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--app-border)] pt-4">
      <Link
        href={href}
        aria-label={`${open}: ${title}`}
        className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-semibold"
      >
        <ExternalLink className="h-4 w-4" />
        {open}
      </Link>
      <button
        type="button"
        onClick={onEdit}
        disabled={busy}
        aria-label={`${edit}: ${title}`}
        className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-semibold disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Edit3 className="h-4 w-4" />
        )}
        {edit}
      </button>
      <button
        type="button"
        onClick={onDestructive}
        disabled={busy}
        aria-label={`${destructiveLabel}: ${title}`}
        className={cn(
          'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-2 text-xs font-semibold disabled:opacity-60',
          destructiveIcon === 'archive'
            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200',
        )}
      >
        <DestructiveIcon className="h-4 w-4" />
        {destructiveLabel}
      </button>
    </div>
  );
}
