'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clapperboard,
  Edit3,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
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
      open: isId ? 'Buka' : 'Open',
      failed: isId ? 'Aksi gagal. Coba lagi.' : 'Action failed. Try again.',
      loadFailed: isId
        ? 'Data milik saya belum bisa dimuat.'
        : 'Could not load your content.',
      loadHint: isId
        ? 'Cek sesi login atau koneksi community service, lalu muat ulang.'
        : 'Check your login session or community service connection, then refresh.',
      saved: isId ? 'Perubahan disimpan.' : 'Changes saved.',
      deleted: isId ? 'Konten dihapus.' : 'Content deleted.',
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
    try {
      const [threadRes, reelRes] = await Promise.all([
        authFetch('/api/forum/threads?mine=true&sort=new&page_size=50', {
          cache: 'no-store',
        }),
        authFetch('/api/reels?mine=true&limit=50', { cache: 'no-store' }),
      ]);
      if (!threadRes.ok || !reelRes.ok) {
        throw new Error(`manage-load:${threadRes.status}:${reelRes.status}`);
      }
      const [threadPayload, reelPayload] = await Promise.all([
        readJson<ForumThreadsResponse>(threadRes),
        readJson<ReelsResponse>(reelRes),
      ]);
      setThreads(Array.isArray(threadPayload.data) ? threadPayload.data : []);
      setReels(extractReels(reelPayload));
    } catch {
      setLoadError(copy.loadFailed);
      notify({ title: copy.failed, variant: 'error' });
    } finally {
      setLoading(false);
    }
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
        isId
          ? 'Hapus postingan komunitas ini?'
          : 'Delete this community post?',
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

  const deleteReel = async (reelId: string) => {
    if (!window.confirm(isId ? 'Hapus reels ini?' : 'Delete this reel?')) return;
    setBusyId(reelId);
    try {
      const response = await authFetch(`/api/reels/${encodeURIComponent(reelId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('failed');
      setReels(current => current.filter(item => item.id !== reelId));
      notify({ title: copy.deleted, variant: 'success' });
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
            hint: isId ? 'views + balasan' : 'views + replies',
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
            hint: 'likes + comments + shares',
          },
        ];

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
              ? 'Manage reels'
              : 'Reels management'
            : mode === 'community'
              ? isId
                ? 'Manage community posting'
                : 'Community post management'
              : isId
                ? 'Manage postingan'
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
              {isId ? 'Semua manage' : 'All manage'}
            </Link>
            {mode !== 'reels' ? (
              <Link
                href="/community?compose=post"
                className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                {isId ? 'Buat komunitas' : 'New post'}
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

      <section className="ui-panel rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {mode === 'all' ? (
            <div className="inline-flex rounded-2xl bg-[color:var(--app-surface-muted)] p-1">
              {[
                {
                  id: 'community' as const,
                  label: copy.community,
                  count: threads.length,
                  icon: MessageCircle,
                },
                {
                  id: 'reels' as const,
                  label: copy.reels,
                  count: reels.length,
                  icon: Clapperboard,
                },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-sm font-semibold',
                      activeTab === tab.id
                        ? 'bg-white text-[color:var(--app-text)] shadow-sm'
                        : 'text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-xs">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <h2 className="text-base font-bold text-[color:var(--app-text)]">
                {activeTab === 'community' ? copy.community : copy.reels}
              </h2>
              <p className="text-sm text-[color:var(--app-text-soft)]">
                {activeTab === 'community'
                  ? isId
                    ? `${threads.length} postingan ditemukan`
                    : `${threads.length} posts found`
                  : isId
                    ? `${reels.length} reels ditemukan`
                    : `${reels.length} reels found`}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void loadContent()}
            className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
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
          <div className="mt-6 flex items-center gap-2 text-sm text-[color:var(--app-text-soft)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.loading}
          </div>
        ) : null}

        {!loading && loadError ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">{loadError}</p>
                <p className="mt-1 leading-6">{copy.loadHint}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !loadError && activeTab === 'community' ? (
          <div className="mt-5 space-y-3">
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
                className="rounded-2xl border border-[color:var(--app-border)] bg-white p-4"
              >
                {editingThread?.id === thread.id ? (
                  <form onSubmit={saveThread} className="space-y-3">
                    <input
                      value={editingThread.title}
                      onChange={event =>
                        setEditingThread(current =>
                          current
                            ? { ...current, title: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-2xl border border-[color:var(--app-border)] px-3 py-2 text-sm font-semibold"
                    />
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
                      className="w-full rounded-2xl border border-[color:var(--app-border)] px-3 py-2 text-sm"
                    />
                    <EditActions
                      busy={busyId === thread.id}
                      save={copy.save}
                      cancel={copy.cancel}
                      onCancel={() => setEditingThread(null)}
                    />
                  </form>
                ) : (
                  <ContentRow
                    title={thread.title}
                    meta={`${formatDate(thread.createdAt, locale)} / ${metric(
                      thread.replyCount,
                    )} ${isId ? 'balasan' : 'replies'} / ${metric(
                      thread.views,
                    )} views`}
                    href={`/community?thread=${encodeURIComponent(thread.id)}`}
                    busy={busyId === thread.id}
                    open={copy.open}
                    edit={copy.edit}
                    deleteLabel={copy.delete}
                    onEdit={() => void startThreadEdit(thread)}
                    onDelete={() => void deleteThread(thread.id)}
                  />
                )}
              </article>
            ))}
          </div>
        ) : null}

        {!loading && !loadError && activeTab === 'reels' ? (
          <div className="mt-5 space-y-3">
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
                className="rounded-2xl border border-[color:var(--app-border)] bg-white p-4"
              >
                {editingReel?.id === reel.id ? (
                  <form onSubmit={saveReel} className="space-y-3">
                    <input
                      value={editingReel.title}
                      onChange={event =>
                        setEditingReel(current =>
                          current
                            ? { ...current, title: event.target.value }
                            : current,
                        )
                      }
                      className="w-full rounded-2xl border border-[color:var(--app-border)] px-3 py-2 text-sm font-semibold"
                    />
                    <input
                      value={editingReel.tag}
                      onChange={event =>
                        setEditingReel(current =>
                          current ? { ...current, tag: event.target.value } : current,
                        )
                      }
                      className="w-full rounded-2xl border border-[color:var(--app-border)] px-3 py-2 text-sm"
                    />
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
                      className="w-full rounded-2xl border border-[color:var(--app-border)] px-3 py-2 text-sm"
                    />
                    <EditActions
                      busy={busyId === reel.id}
                      save={copy.save}
                      cancel={copy.cancel}
                      onCancel={() => setEditingReel(null)}
                    />
                  </form>
                ) : (
                  <ContentRow
                    title={reel.title}
                    meta={`${reel.tag} / ${metric(reel.likesCount)} likes / ${metric(
                      reel.commentsCount,
                    )} ${isId ? 'komentar' : 'comments'}`}
                    href={`/reels?reel=${encodeURIComponent(reel.id)}`}
                    busy={busyId === reel.id}
                    open={copy.open}
                    edit={copy.edit}
                    deleteLabel={copy.delete}
                    onEdit={() =>
                      setEditingReel({
                        id: reel.id,
                        title: reel.title,
                        caption: reel.caption,
                        tag: reel.tag,
                      })
                    }
                    onDelete={() => void deleteReel(reel.id)}
                  />
                )}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
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
    <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5 text-sm text-[color:var(--app-text-soft)]">
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
        className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
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
        className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold"
      >
        <X className="h-4 w-4" />
        {cancel}
      </button>
    </div>
  );
}

function ContentRow({
  title,
  meta,
  href,
  busy,
  open,
  edit,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  title: string;
  meta: string;
  href: string;
  busy: boolean;
  open: string;
  edit: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-[color:var(--app-text)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{meta}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href={href}
          className="ui-button-secondary inline-flex items-center gap-2 px-3 text-sm font-semibold"
        >
          <ExternalLink className="h-4 w-4" />
          {open}
        </Link>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="ui-button-secondary inline-flex items-center gap-2 px-3 text-sm font-semibold disabled:opacity-60"
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
          onClick={onDelete}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          {deleteLabel}
        </button>
      </div>
    </div>
  );
}
