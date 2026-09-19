'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCcw, ShieldCheck } from 'lucide-react';

type RequestItem = {
  id: string;
  request_type: string;
  status: string;
  requested_at: string;
  due_at: string | null;
  decision_note: string | null;
  completed_at: string | null;
};

type Props = { locale: 'id' | 'en' };

const TYPES = [
  ['access', 'Akses data', 'Access my data'],
  ['correction', 'Koreksi data', 'Correct my data'],
  ['export', 'Ekspor data', 'Export my data'],
  ['deletion', 'Hapus data', 'Delete my data'],
  ['withdraw_consent', 'Tarik persetujuan', 'Withdraw consent'],
  ['restrict', 'Batasi pemrosesan', 'Restrict processing'],
  ['objection', 'Keberatan', 'Object to processing'],
] as const;

function labelForType(value: string, isId: boolean) {
  return TYPES.find(([key]) => key === value)?.[isId ? 1 : 2] ?? value;
}

function labelForStatus(value: string, isId: boolean) {
  const labels: Record<string, [string, string]> = {
    open: ['Menunggu pemeriksaan', 'Queued'],
    in_review: ['Sedang diperiksa', 'In review'],
    waiting_user: ['Menunggu informasi kamu', 'Waiting for you'],
    completed: ['Selesai', 'Completed'],
    rejected: ['Ditolak', 'Rejected'],
    cancelled: ['Dibatalkan', 'Cancelled'],
  };
  return labels[value]?.[isId ? 0 : 1] ?? value;
}

export function PrivacyRequestCenter({ locale }: Props) {
  const isId = locale === 'id';
  const [items, setItems] = useState<RequestItem[]>([]);
  const [type, setType] = useState('access');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/privacy/requests', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as { data?: RequestItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'request_failed');
      setItems(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setError(isId ? 'Permintaan privasi belum bisa dimuat.' : 'Privacy requests could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [isId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/privacy/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request_type: type, note: note.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'request_failed');
      setNote('');
      setMessage(isId ? 'Permintaan berhasil dibuat.' : 'Request created successfully.');
      await load();
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'request_failed'
          ? err.message
          : isId
            ? 'Permintaan belum berhasil dibuat.'
            : 'The request could not be created.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="ui-panel rounded-[22px] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-black text-[color:var(--app-text)]">
              {isId ? 'Permintaan data & privasi' : 'Privacy & data requests'}
            </h1>
            <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Pilih kebutuhanmu. Kami memberi nomor permintaan dan status yang bisa kamu pantau.'
                : 'Choose what you need. We give you a request ID and a status you can track.'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
          <label className="text-xs font-bold text-[color:var(--app-text)]">
            {isId ? 'Jenis permintaan' : 'Request type'}
            <select
              value={type}
              onChange={event => setType(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]/25"
            >
              {TYPES.map(([key, idLabel, enLabel]) => (
                <option key={key} value={key}>
                  {isId ? idLabel : enLabel}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-[color:var(--app-text)]">
            {isId ? 'Catatan (opsional)' : 'Note (optional)'}
            <textarea
              value={note}
              onChange={event => setNote(event.target.value.slice(0, 5000))}
              rows={3}
              maxLength={5000}
              placeholder={
                isId
                  ? 'Jelaskan data atau alasan permintaanmu.'
                  : 'Tell us what data or context you need.'
              }
              className="mt-1.5 w-full resize-y rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]/25"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="ui-button-primary inline-flex min-h-10 items-center gap-2 px-4 text-sm disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isId ? 'Buat permintaan' : 'Create request'}
          </button>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="ui-button-secondary inline-flex min-h-10 items-center gap-2 px-4 text-sm"
          >
            <RefreshCcw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {isId ? 'Muat ulang' : 'Refresh'}
          </button>
        </div>

        {message ? <p className="mt-2 text-xs font-semibold text-[color:var(--app-accent)]">{message}</p> : null}
        {error ? <p className="mt-2 text-xs font-semibold text-[color:var(--app-danger)]">{error}</p> : null}
      </section>

      <section className="ui-panel rounded-[22px] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-[color:var(--app-text)]">
            {isId ? 'Riwayat permintaan' : 'Request history'}
          </h2>
          <span className="text-[10px] font-bold text-[color:var(--app-text-soft)]">
            {items.length}
          </span>
        </div>

        {loading ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map(item => (
              <div
                key={item}
                className="h-20 animate-pulse rounded-xl bg-[color:var(--app-surface-muted)]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-xl bg-[color:var(--app-surface-muted)] p-5 text-center text-xs text-[color:var(--app-text-soft)]">
            {isId ? 'Belum ada permintaan.' : 'No requests yet.'}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map(item => (
              <article
                key={item.id}
                className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[color:var(--app-text)]">
                      {labelForType(item.request_type, isId)}
                    </h3>
                    <p className="mt-0.5 break-all text-[10px] font-medium text-[color:var(--app-text-soft)]">
                      #{item.id}
                    </p>
                  </div>
                  <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)]">
                    {labelForStatus(item.status, isId)}
                  </span>
                </div>
                <div className="mt-3 grid gap-1 text-[11px] text-[color:var(--app-text-soft)] sm:grid-cols-2">
                  <span>
                    {isId ? 'Dibuat' : 'Created'}: {new Date(item.requested_at).toLocaleString(isId ? 'id-ID' : 'en-US')}
                  </span>
                  {item.due_at ? (
                    <span>
                      {isId ? 'Target' : 'Target'}: {new Date(item.due_at).toLocaleString(isId ? 'id-ID' : 'en-US')}
                    </span>
                  ) : null}
                </div>
                {item.decision_note ? (
                  <p className="mt-2 rounded-lg bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs text-[color:var(--app-text-soft)]">
                    {item.decision_note}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
