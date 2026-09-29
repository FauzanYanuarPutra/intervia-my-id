'use client';

import { useRef, useState } from 'react';
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
      };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            (isId
              ? 'Foto belum berhasil dikirim.'
              : 'Photo could not be submitted.'),
        );
      }

      setNotice(
        isId
          ? 'Foto masuk antrean review Lajukan.'
          : 'Photo submitted for Lajukan review.',
      );
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

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
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
        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-white px-3 text-[10px] font-bold text-[color:var(--app-accent)] shadow-sm transition hover:bg-[color:var(--app-accent-soft)] disabled:cursor-wait disabled:opacity-60"
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

      {notice ? (
        <span className="inline-flex min-h-[28px] items-center gap-1 rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[9px] font-semibold text-[color:var(--app-text)]">
          {notice.includes('antrean') || notice.includes('submitted') ? (
            <CheckCircle2 className="h-3 w-3 shrink-0" />
          ) : null}
          <span className="max-w-[220px] truncate">{notice}</span>
        </span>
      ) : null}
    </div>
  );
}
