'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

type PrivacyActionsProps = {
  locale: 'id' | 'en';
};

export function PrivacyActions({ locale }: PrivacyActionsProps) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/user/export-data', { method: 'GET' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const reason =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : `Export failed (${res.status})`;
        throw new Error(reason);
      }
      setMessage(
        locale === 'id'
          ? 'Permintaan export diterima. Cek email atau notifikasi untuk hasilnya.'
          : 'Export request received. Check your email or notifications for the result.',
      );
    } catch (err) {
      const fallback =
        locale === 'id'
          ? 'Export data belum berhasil. Silakan coba lagi atau buka menu Pengaturan.'
          : 'Export failed. Please retry or use Settings.';
      setError(err instanceof Error && err.message.trim() ? err.message : fallback);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setMessage(
        locale === 'id'
          ? 'Untuk keamanan, penghapusan akun dilanjutkan di Pengaturan dengan verifikasi password. Klik sekali lagi untuk buka Pengaturan.'
          : 'For safety, account deletion continues in Settings with password verification. Click once more to open Settings.',
      );
      return;
    }

    setDeleting(true);
    router.push('/settings');
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm disabled:opacity-70"
        >
          {exporting
            ? locale === 'id'
              ? 'Memproses export...'
              : 'Requesting export...'
            : locale === 'id'
              ? 'Export data'
              : 'Export data'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm disabled:opacity-70"
        >
          {deleting
            ? locale === 'id'
              ? 'Menghapus...'
              : 'Deleting...'
            : locale === 'id'
              ? confirmDelete
                ? 'Konfirmasi hapus'
                : 'Hapus akun'
              : confirmDelete
                ? 'Confirm delete'
                : 'Delete account'}
        </button>
        <Link href="/settings" className="ui-button-secondary inline-flex items-center px-4 text-sm">
          {locale === 'id' ? 'Buka Pengaturan' : 'Open Settings'}
        </Link>
      </div>
      {message ? <p className="text-xs text-[color:var(--app-text)]">{message}</p> : null}
      {error ? <p className="text-xs text-[color:var(--app-danger)]">{error}</p> : null}
    </div>
  );
}
