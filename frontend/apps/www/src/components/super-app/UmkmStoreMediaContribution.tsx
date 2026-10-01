'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function UmkmStoreMediaContribution({
  storeId,
  isId,
  loginHref,
  onSubmitted,
}: {
  storeId: string;
  isId: boolean;
  loginHref: string;
  onSubmitted?: () => void;
}) {
  const { user, authFetch, loading: authLoading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewerItems, setViewerItems] = useState<
    Array<{
      id: string;
      media_url: string;
      media_type: string;
      status: 'pending' | 'approved' | 'rejected' | 'hidden';
      review_note: string | null;
      caption: string | null;
      uploader_name_snapshot: string | null;
      uploader_username_snapshot: string | null;
    }>
  >([]);
  const [queueItems, setQueueItems] = useState<
    Array<{
      id: string;
      media_url: string;
      media_type: string;
      status: 'pending' | 'approved' | 'rejected' | 'hidden';
      review_note: string | null;
      caption: string | null;
      uploader_name_snapshot: string | null;
      uploader_username_snapshot: string | null;
    }>
  >([]);
  const [isStoreOwner, setIsStoreOwner] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadContributionStatus = useCallback(async () => {
    if (!user) {
      setViewerItems([]);
      setQueueItems([]);
      setIsStoreOwner(false);
      return;
    }

    setStatusLoading(true);
    try {
      const response = await authFetch(
        `/api/super-app/umkm/stores/${encodeURIComponent(storeId)}/media/contributions`,
        { cache: 'no-store' },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: {
          viewer?: {
            is_store_owner?: boolean;
            my_items?: typeof viewerItems;
            queue_items?: typeof viewerItems;
          } | null;
        };
      };

      if (!response.ok) return;

      const viewer = payload.data?.viewer;
      setViewerItems(Array.isArray(viewer?.my_items) ? viewer.my_items : []);
      setQueueItems(
        Array.isArray(viewer?.queue_items) ? viewer.queue_items : [],
      );
      setIsStoreOwner(Boolean(viewer?.is_store_owner));
    } catch {
      // Status UI must never block the public store page.
    } finally {
      setStatusLoading(false);
    }
  }, [authFetch, storeId, user]);

  useEffect(() => {
    void loadContributionStatus();
  }, [loadContributionStatus]);

  async function submit(file: File) {
    if (!user) {
      window.location.href = loginHref;
      return;
    }

    setUploading(true);
    setNotice(null);

    try {
      const body = new FormData();
      body.append('file', file, file.name);

      const response = await authFetch(
        `/api/super-app/umkm/stores/${encodeURIComponent(storeId)}/media/contributions`,
        {
          method: 'POST',
          body,
          cache: 'no-store',
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          status?: 'pending' | 'approved' | 'rejected' | 'hidden';
        };
      };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            (isId
              ? 'Foto belum berhasil dikirim.'
              : 'Photo could not be submitted.'),
        );
      }

      const status = payload.data?.status || 'pending';
      setNotice(
        status === 'approved'
          ? isId
            ? 'Foto langsung tampil di toko.'
            : 'Photo is now live on the store.'
          : isId
            ? 'Foto sudah tersimpan dan menunggu verifikasi Lajukan. Foto belum tampil untuk publik.'
            : 'Photo was saved and is waiting for Lajukan review. It is not public yet.',
      );
      await loadContributionStatus();
      onSubmitted?.();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : isId
            ? 'Upload foto gagal.'
            : 'Photo upload failed.',
      );
    } finally {
      setUploading(false);
    }
  }

  const statusLabel = (status: typeof viewerItems[number]['status']) => {
    if (isId) {
      if (status === 'pending') return 'Menunggu verifikasi';
      if (status === 'approved') return 'Disetujui · tampil di toko';
      if (status === 'rejected') return 'Ditolak';
      return 'Disembunyikan';
    }
    if (status === 'pending') return 'Waiting for review';
    if (status === 'approved') return 'Approved · live';
    if (status === 'rejected') return 'Rejected';
    return 'Hidden';
  };

  const statusClass = (status: typeof viewerItems[number]['status']) =>
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
      : status === 'pending'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200';

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:items-end">
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            event.currentTarget.value = '';
            if (file) void submit(file);
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (authLoading) return;
            inputRef.current?.click();
          }}
          disabled={uploading || authLoading}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-white px-3 text-[10px] font-bold text-[color:var(--app-accent)] shadow-sm transition hover:bg-[color:var(--app-accent-soft)] disabled:cursor-wait disabled:opacity-60 dark:bg-slate-900"
          title={isId ? 'Tambahkan foto usaha' : 'Add a business photo'}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : user ? (
            <Upload className="h-3.5 w-3.5" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          {user
            ? isId
              ? 'Tambah foto'
              : 'Add photo'
            : isId
              ? 'Login untuk foto'
              : 'Login to add'}
        </button>

        {user ? (
          <button
            type="button"
            onClick={() => void loadContributionStatus()}
            disabled={statusLoading}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {statusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {isId ? 'Cek status' : 'Check status'}
          </button>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className="w-full rounded-xl bg-[color:var(--app-accent-soft)] px-3 py-2 text-[10px] font-semibold leading-4 text-[color:var(--app-text)]"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        </div>
      ) : null}

      {user && (viewerItems.length > 0 || (isStoreOwner && queueItems.length > 0)) ? (
        <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100">
                {isId ? 'Status foto Anda' : 'Your photo status'}
              </p>
              <p className="mt-0.5 text-[9px] font-medium text-slate-500 dark:text-slate-400">
                {isId
                  ? 'Foto baru tampil di publik setelah disetujui.'
                  : 'New photos appear publicly after approval.'}
              </p>
            </div>
            {isStoreOwner && queueItems.length > 0 ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-extrabold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                {queueItems.length} {isId ? 'di antrean' : 'in review queue'}
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            {viewerItems.slice(0, 4).map(item => (
              <div
                key={item.id}
                className="flex min-w-0 items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/5"
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {item.media_url ? (
                    <img
                      src={item.media_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-extrabold ${statusClass(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                  {item.review_note ? (
                    <p className="mt-1 line-clamp-2 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                      {item.review_note}
                    </p>
                  ) : item.status === 'pending' ? (
                    <p className="mt-1 text-[9px] font-medium text-slate-500 dark:text-slate-400">
                      {isId
                        ? 'Sedang diperiksa. Tidak perlu upload ulang selama belum ada hasil review.'
                        : 'Under review. No need to upload again while pending.'}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {isStoreOwner && queueItems.length > 0 ? (
            <div className="mt-3 border-t border-slate-200 pt-2.5 dark:border-slate-700">
              <div className="mb-2">
                <p className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100">
                  {isId ? 'Antrean review toko' : 'Store review queue'}
                </p>
                <p className="mt-0.5 text-[9px] font-medium text-slate-500 dark:text-slate-400">
                  {isId
                    ? 'Kontribusi pengguna menunggu pemeriksaan Lajukan. Pemilik tidak perlu menyetujui manual.'
                    : 'Community contributions are waiting for Lajukan review. The owner does not need to approve them manually.'}
                </p>
              </div>
              <div className="space-y-1.5">
                {queueItems.slice(0, 4).map(item => (
                  <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/5">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                      {item.media_url ? (
                        <img src={item.media_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[9px] font-extrabold text-slate-700 dark:text-slate-200">
                        {item.uploader_name_snapshot ||
                          (item.uploader_username_snapshot
                            ? '@' + item.uploader_username_snapshot
                            : isId
                              ? 'Pengguna Lajukan'
                              : 'Lajukan user')}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-extrabold ${statusClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                        {item.review_note ? (
                          <span className="min-w-0 truncate text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                            {item.review_note}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
