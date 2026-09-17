'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useRequireAuth } from '@/context/AuthContext';
import { newsApi } from '@/lib/api';
import { Button, Card } from '@/ui';
import { Alert } from 'lajukan-ui';

type NewsItem = {
  id: string;
  owner_id: string;
  slug?: string | null;
  title: string;
  summary?: string | null;
  body: string;
  metadata?: Record<string, unknown>;
  content_status: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID');
}

export default function NewsModeration() {
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const { accessToken } = useAuth();
  const [status, setStatus] = useState('pending_review');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const [businessImpact, setBusinessImpact] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = useMemo(
    () => items.find(item => item.id === selectedId) || items[0] || null,
    [items, selectedId],
  );

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    const meta = selected ? readRecord(readRecord(selected.metadata).news) : {};
    setBusinessImpact(readString(meta.business_impact));
  }, [selected?.id]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const payload = await newsApi.queue(accessToken, status);
      const record = readRecord(payload);
      setItems(Array.isArray(record.items) ? (record.items as NewsItem[]) : []);
      setSuccess('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat antrean berita');
    } finally {
      setLoading(false);
    }
  }, [accessToken, status]);

  useEffect(() => {
    if (!accessToken) return;
    void load();
  }, [accessToken, load]);

  const moderate = async (action: 'approve' | 'needs_revision' | 'reject' | 'retract' | 'correct') => {
    if (!accessToken || !selected) return;
    setActing(true);
    setError('');
    setSuccess('');
    try {
      await newsApi.moderate(accessToken, selected.id, { action, note: note.trim() || undefined, business_impact: businessImpact.trim() || undefined });
      setSuccess(`Aksi "${action}" berhasil untuk: ${selected.title}`);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memoderasi berita');
    } finally {
      setActing(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen grid place-items-center text-sm">Memuat...</div>;
  }
  if (!isAuthenticated) return null;

  const newsMeta = selected ? readRecord(readRecord(selected.metadata).news) : {};
  const category = readString(newsMeta.category) || '-';
  const kind = readString(newsMeta.article_kind) || 'news';
  const location = readString(newsMeta.location) || '-';
  const sourceUrls = Array.isArray(newsMeta.source_urls)
    ? newsMeta.source_urls.map(readString).filter(Boolean)
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">Lajukan CMS</p>
          <h1 className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">Editorial News</h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-soft)]">Review kiriman sebelum diterbitkan sebagai Lajukan News.</p>
        </div>
        <div className="flex gap-2">
          <a href="/" className="inline-flex min-h-10 items-center rounded-xl border border-[color:var(--color-border)] px-4 text-xs font-semibold text-[color:var(--color-text)]">CMS utama</a>
          <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
        </div>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {['pending_review', 'needs_revision', 'published', 'rejected', 'retracted', 'all'].map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold ${status === value ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]'}`}
          >
            {value.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.25fr)]">
        <Card title={`Antrean (${items.length})`}>
          {loading ? (
            <p className="text-sm text-[color:var(--color-text-soft)]">Memuat...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[color:var(--color-text-soft)]">Tidak ada item pada status ini.</p>
          ) : (
            <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {items.map(item => {
                const meta = readRecord(readRecord(item.metadata).news);
                const editorialStatus = readString(meta.editorial_status) || item.content_status;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setSelectedId(item.id); setNote(''); setSuccess(''); }}
                    className={`w-full rounded-2xl border p-3 text-left transition ${selected?.id === item.id ? 'border-[color:var(--color-primary)] bg-[color:var(--color-surface-muted)]' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'}`}
                  >
                    <p className="text-sm font-semibold text-[color:var(--color-text)]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--color-text-soft)]">{item.summary || 'Tanpa ringkasan'}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-[color:var(--color-text-soft)]">
                      <span>{editorialStatus}</span><span>•</span><span>{formatDate(item.updated_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card title={selected ? selected.title : 'Detail berita'}>
          {!selected ? (
            <p className="text-sm text-[color:var(--color-text-soft)]">Pilih item dari antrean.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-[color:var(--color-text-soft)]">
                <span>Kategori: {category}</span>
                <span>•</span>
                <span>Jenis: {kind}</span>
                <span>•</span>
                <span>Lokasi: {location}</span>
                <span>•</span>
                <span>Owner: {selected.owner_id}</span>
              </div>
              {selected.summary ? <p className="rounded-2xl bg-[color:var(--color-surface-muted)] p-4 text-sm font-semibold leading-6 text-[color:var(--color-text)]">{selected.summary}</p> : null}
              <div className="max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[color:var(--color-border)] p-4 text-sm leading-7 text-[color:var(--color-text)]">{selected.body}</div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-soft)]">Sumber</p>
                {sourceUrls.length ? (
                  <div className="grid gap-1">
                    {sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="break-all text-xs font-semibold text-[color:var(--color-primary)] underline">{url}</a>)}
                  </div>
                ) : (
                  <p className="text-xs text-[color:var(--color-text-soft)]">Tidak ada URL sumber. Pastikan jenis konten memang rilis bisnis sebelum approve.</p>
                )}
              </div>

              <label className="block text-sm font-semibold text-[color:var(--color-text)]">
                Dampak untuk pelaku usaha
                <textarea value={businessImpact} onChange={event => setBusinessImpact(event.target.value)} rows={4} maxLength={2000} className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-sm" placeholder="Jelaskan implikasi praktis berita ini untuk UMKM/pelaku usaha..." />
              </label>

              <label className="block text-sm font-semibold text-[color:var(--color-text)]">
                Catatan editor
                <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} maxLength={4000} className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-sm" placeholder="Alasan revisi/penolakan atau catatan pemeriksaan..." />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button disabled={acting} variant="primary" onClick={() => void moderate('approve')}>Approve & publish</Button>
                <Button disabled={acting} variant="secondary" onClick={() => void moderate('needs_revision')}>Minta revisi</Button>
                <Button disabled={acting} variant="danger" onClick={() => void moderate('reject')}>Tolak</Button>
                {status === 'published' || selected.content_status === 'active' ? (
                  <>
                    <Button disabled={acting} variant="secondary" onClick={() => void moderate('correct')}>Catat koreksi</Button>
                    <Button disabled={acting} variant="danger" onClick={() => void moderate('retract')}>Tarik publikasi</Button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
