'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useRequireAuth } from '@/context/AuthContext';
import { newsApi } from '@/lib/api';
import { Button, Card } from '@/ui';
import { Alert } from 'lajukan-ui';

type EditorialEvent = {
  id: string;
  action: string;
  actor_role: string;
  from_status?: string | null;
  to_status: string;
  note?: string | null;
  created_at: string;
};

type NewsVersion = {
  id: string;
  version_number: number;
  actor_role: string;
  action: string;
  editorial_status?: string | null;
  title: string;
  summary?: string | null;
  created_at: string;
};

type NewsSource = {
  id: string;
  source_url: string;
  source_domain?: string | null;
  source_kind: 'user_supplied' | 'primary' | 'secondary' | 'official' | 'business';
  verification_status: 'unverified' | 'verified' | 'broken' | 'rejected';
  editor_note?: string | null;
  checked_at?: string | null;
};

type NewsSourceReview = {
  id: string;
  source_id?: string | null;
  source_url_snapshot?: string | null;
  source_domain_snapshot?: string | null;
  reviewer_id: string;
  from_source_kind: NewsSource['source_kind'];
  to_source_kind: NewsSource['source_kind'];
  from_verification_status: NewsSource['verification_status'];
  to_verification_status: NewsSource['verification_status'];
  note?: string | null;
  created_at: string;
};

type NewsroomMetrics = {
  queue?: Array<{ key: string; value: number }>;
  engagement_24h?: Array<{ key: string; value: number }>;
  published_24h?: number;
  published_7d?: number;
  avg_review_minutes?: number | null;
  versions?: number;
  sources?: { total?: number; verified?: number; flagged?: number };
  top_articles_7d?: Array<{ id: string; slug?: string | null; title: string; opens: number }>;
};

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

function isSafeExternalSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return false;
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    ) {
      return false;
    }
    if (
      host.includes(':') &&
      (host === '::' ||
        host === '::1' ||
        host.startsWith('fc') ||
        host.startsWith('fd') ||
        /^fe[89ab]/.test(host))
    ) {
      return false;
    }
    const parts = host.split('.').map(Number);
    if (
      parts.length === 4 &&
      parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)
    ) {
      const [a, b] = parts;
      if (
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 0
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
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
  const [history, setHistory] = useState<EditorialEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [versions, setVersions] = useState<NewsVersion[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [sourceReviews, setSourceReviews] = useState<NewsSourceReview[]>([]);
  const [metrics, setMetrics] = useState<NewsroomMetrics>({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [sourceUpdating, setSourceUpdating] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = useMemo(
    () => items.find(item => item.id === selectedId) || items[0] || null,
    [items, selectedId],
  );

  useEffect(() => {
    if (!accessToken || !selected?.id) return;
    let active = true;
    void newsApi.history(accessToken, selected.id)
      .then(payload => {
        if (!active) return;
        const record = readRecord(payload);
        setHistory(Array.isArray(record.items) ? (record.items as EditorialEvent[]) : []);
        setVersions(Array.isArray(record.versions) ? (record.versions as NewsVersion[]) : []);
        setSources(Array.isArray(record.sources) ? (record.sources as NewsSource[]) : []);
        setSourceReviews(
          Array.isArray(record.source_reviews)
            ? (record.source_reviews as NewsSourceReview[])
            : [],
        );
      })
      .catch(() => {
        if (!active) return;
        setHistory([]);
        setVersions([]);
        setSources([]);
        setSourceReviews([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, selected?.id]);

  const loadMetrics = useCallback(async () => {
    if (!accessToken) return;
    setMetricsLoading(true);
    try {
      const payload = await newsApi.metrics(accessToken);
      setMetrics(readRecord(payload) as NewsroomMetrics);
    } catch {
      setMetrics({});
    } finally {
      setMetricsLoading(false);
    }
  }, [accessToken]);

  const reviewSource = async (
    source: NewsSource,
    verificationStatus: NewsSource['verification_status'],
    sourceKind: NewsSource['source_kind'] = source.source_kind,
  ) => {
    if (!accessToken || !selected) return;
    setSourceUpdating(source.id);
    setError('');
    try {
      await newsApi.updateSource(accessToken, selected.id, source.id, {
        source_kind: sourceKind,
        verification_status: verificationStatus,
      });
      const payload = await newsApi.history(accessToken, selected.id);
      const record = readRecord(payload);
      setSources(Array.isArray(record.sources) ? (record.sources as NewsSource[]) : []);
      setSourceReviews(
        Array.isArray(record.source_reviews)
          ? (record.source_reviews as NewsSourceReview[])
          : [],
      );
      setSuccess(`Status sumber diperbarui: ${source.source_domain || source.source_url}`);
      void loadMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui sumber');
    } finally {
      setSourceUpdating('');
    }
  };

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const payload = await newsApi.queue(accessToken, status);
      const record = readRecord(payload);
      const nextItems = Array.isArray(record.items) ? (record.items as NewsItem[]) : [];
      const nextSelected = nextItems.find(item => item.id === selectedId) || nextItems[0] || null;
      setItems(nextItems);
      setSelectedId(nextSelected?.id || '');
      setBusinessImpact(
        nextSelected
          ? readString(readRecord(readRecord(nextSelected.metadata).news).business_impact)
          : '',
      );
      setHistoryLoading(Boolean(nextSelected));
      setSuccess('');
      void loadMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat antrean berita');
    } finally {
      setLoading(false);
    }
  }, [accessToken, loadMetrics, selectedId, status]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void newsApi.queue(accessToken, status)
      .then(payload => {
        if (!active) return;
        const record = readRecord(payload);
        const nextItems = Array.isArray(record.items) ? (record.items as NewsItem[]) : [];
        const nextSelected = nextItems[0] || null;
        setItems(nextItems);
        setSelectedId(nextSelected?.id || '');
        setBusinessImpact(
          nextSelected
            ? readString(readRecord(readRecord(nextSelected.metadata).news).business_impact)
            : '',
        );
        setHistoryLoading(Boolean(nextSelected));
        setSuccess('');
      })
      .catch(err => {
        if (!active) return;
        setItems([]);
        setSelectedId('');
        setBusinessImpact('');
        setError(err instanceof Error ? err.message : 'Gagal memuat antrean berita');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, status]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void newsApi.metrics(accessToken)
      .then(payload => {
        if (active) setMetrics(readRecord(payload) as NewsroomMetrics);
      })
      .catch(() => {
        if (active) setMetrics({});
      })
      .finally(() => {
        if (active) setMetricsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const moderate = async (action: 'approve' | 'needs_revision' | 'reject' | 'retract' | 'correct') => {
    if (!accessToken || !selected) return;
    const requiresNote = action !== 'approve';
    if (requiresNote && !note.trim()) {
      setError('Catatan editor wajib untuk revisi, penolakan, koreksi, atau penarikan publikasi.');
      return;
    }
    setActing(true);
    setError('');
    setSuccess('');
    try {
      await newsApi.moderate(accessToken, selected.id, { action, note: note.trim() || undefined, business_impact: businessImpact.trim() || undefined });
      setSuccess(`Aksi "${action}" berhasil untuk: ${selected.title}`);
      setNote('');
      await load();
      if (selected?.id) {
        const payload = await newsApi.history(accessToken, selected.id);
        const record = readRecord(payload);
        setHistory(Array.isArray(record.items) ? (record.items as EditorialEvent[]) : []);
        setVersions(Array.isArray(record.versions) ? (record.versions as NewsVersion[]) : []);
        setSources(Array.isArray(record.sources) ? (record.sources as NewsSource[]) : []);
      }
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
  const requiresVerifiedSource = kind !== 'press_release';
  const editorialStatus =
    readString(newsMeta.editorial_status) ||
    (selected?.content_status === 'active'
      ? 'published'
      : selected?.content_status === 'archived'
        ? 'rejected'
        : 'pending_review');
  const hasVerifiedSource = sources.some(
    source =>
      source.verification_status === 'verified' &&
      isSafeExternalSourceUrl(source.source_url),
  );
  const wouldBreakPublishedProvenance = (
    source: NewsSource,
    nextStatus: NewsSource['verification_status'],
  ) =>
    editorialStatus === 'published' &&
    requiresVerifiedSource &&
    source.verification_status === 'verified' &&
    nextStatus !== 'verified' &&
    !sources.some(
      candidate =>
        candidate.id !== source.id &&
        candidate.verification_status === 'verified' &&
        isSafeExternalSourceUrl(candidate.source_url),
    );
  const sourceUrls = Array.isArray(newsMeta.source_urls)
    ? newsMeta.source_urls
        .map(readString)
        .filter(url => Boolean(url) && isSafeExternalSourceUrl(url))
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
          <Link href="/" className="inline-flex min-h-10 items-center rounded-xl border border-[color:var(--color-border)] px-4 text-xs font-semibold text-[color:var(--color-text)]">CMS utama</Link>
          <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
        </div>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Terbit 24 jam', value: metrics.published_24h ?? 0 },
          { label: 'Terbit 7 hari', value: metrics.published_7d ?? 0 },
          { label: 'Rata-rata review', value: metrics.avg_review_minutes == null ? '-' : `${Math.round(metrics.avg_review_minutes)} mnt` },
          { label: 'Sumber verified', value: metrics.sources?.verified ?? 0 },
          { label: 'Sumber bermasalah', value: metrics.sources?.flagged ?? 0 },
        ].map(metric => (
          <div key={metric.label} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-soft)]">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">{metricsLoading ? '…' : metric.value}</p>
          </div>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {['pending_review', 'needs_revision', 'published', 'rejected', 'retracted', 'all'].map(value => (
          <button
            key={value}
            type="button"
            onClick={() => { setLoading(true); setStatus(value); }}
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
                    onClick={() => {
                      setSelectedId(item.id);
                      setBusinessImpact(readString(meta.business_impact));
                      setHistory([]);
                      setVersions([]);
                      setSources([]);
                      setHistoryLoading(true);
                      setNote('');
                      setSuccess('');
                    }}
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

              <section className="rounded-2xl border border-[color:var(--color-border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-soft)]">Source provenance</p>
                    <p className="mt-1 text-xs text-[color:var(--color-text-soft)]">Klasifikasi dan verifikasi sumber disimpan terpisah dari isi artikel.</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--color-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--color-text-soft)]">{sources.length || sourceUrls.length} sumber</span>
                </div>
                {sources.length ? (
                  <div className="mt-3 space-y-2">
                    {sources.map(source => (
                      <div key={source.id} className="rounded-xl bg-[color:var(--color-surface-muted)] p-3">
                        <a href={source.source_url} target="_blank" rel="noreferrer" className="block break-all text-xs font-semibold text-[color:var(--color-primary)] underline">
                          {source.source_domain || source.source_url}
                        </a>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={source.source_kind}
                            disabled={sourceUpdating === source.id}
                            onChange={event => void reviewSource(source, source.verification_status, event.target.value as NewsSource['source_kind'])}
                            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-[11px]"
                          >
                            <option value="user_supplied">user supplied</option>
                            <option value="primary">primary</option>
                            <option value="secondary">secondary</option>
                            <option value="official">official</option>
                            <option value="business">business</option>
                          </select>
                          {(['unverified', 'verified', 'broken', 'rejected'] as const).map(value => (
                            <button
                              key={value}
                              type="button"
                              disabled={
                                sourceUpdating === source.id ||
                                wouldBreakPublishedProvenance(source, value)
                              }
                              title={
                                wouldBreakPublishedProvenance(source, value)
                                  ? 'Verifikasi sumber pengganti atau retract artikel sebelum menurunkan verified terakhir.'
                                  : undefined
                              }
                              onClick={() => void reviewSource(source, value)}
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${source.verification_status === value ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white' : 'border-[color:var(--color-border)] text-[color:var(--color-text-soft)]'}`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                        {source.checked_at ? <p className="mt-2 text-[10px] text-[color:var(--color-text-soft)]">Dicek {formatDate(source.checked_at)}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : sourceUrls.length ? (
                  <div className="mt-3 grid gap-1">
                    {sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="break-all text-xs font-semibold text-[color:var(--color-primary)] underline">{url}</a>)}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[color:var(--color-text-soft)]">Tidak ada URL sumber. Pastikan jenis konten memang rilis bisnis sebelum approve.</p>
                )}
              </section>

              {requiresVerifiedSource && !hasVerifiedSource ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                  Minimal satu sumber harus ditandai <strong>verified</strong> sebelum berita/analisis dapat dipublish.
                </div>
              ) : null}
              {editorialStatus === 'published' && requiresVerifiedSource ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold leading-5 text-sky-900">
                  Artikel published harus selalu mempertahankan minimal satu sumber public-safe yang verified. Jika verified terakhir bermasalah, verifikasi sumber pengganti atau retract artikel lebih dulu.
                </div>
              ) : null}

              <label className="block text-sm font-semibold text-[color:var(--color-text)]">
                Dampak untuk pelaku usaha
                <textarea value={businessImpact} onChange={event => setBusinessImpact(event.target.value)} rows={4} maxLength={2000} className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-sm" placeholder="Jelaskan implikasi praktis berita ini untuk UMKM/pelaku usaha..." />
              </label>

              <label className="block text-sm font-semibold text-[color:var(--color-text)]">
                Catatan editor
                <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} maxLength={4000} className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-sm" placeholder="Alasan revisi/penolakan atau catatan pemeriksaan..." />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button disabled={acting || (requiresVerifiedSource && !hasVerifiedSource)} variant="primary" onClick={() => void moderate('approve')}>Approve & publish</Button>
                <Button disabled={acting || !note.trim()} variant="secondary" onClick={() => void moderate('needs_revision')}>Minta revisi</Button>
                <Button disabled={acting || !note.trim()} variant="danger" onClick={() => void moderate('reject')}>Tolak</Button>
                {status === 'published' || selected.content_status === 'active' ? (
                  <>
                    <Button disabled={acting || !note.trim() || (requiresVerifiedSource && !hasVerifiedSource)} variant="secondary" onClick={() => void moderate('correct')}>Catat koreksi</Button>
                    <Button disabled={acting || !note.trim()} variant="danger" onClick={() => void moderate('retract')}>Tarik publikasi</Button>
                  </>
                ) : null}
              </div>

              <section className="rounded-2xl border border-[color:var(--color-border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-soft)]">Versi artikel</p>
                    <p className="mt-1 text-xs text-[color:var(--color-text-soft)]">Snapshot immutable setiap submit, resubmit, publish, koreksi, dan penarikan.</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--color-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--color-text-soft)]">{versions.length} versi</span>
                </div>
                {versions.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {versions.slice(0, 8).map(version => (
                      <div key={version.id} className="rounded-xl bg-[color:var(--color-surface-muted)] p-3">
                        <p className="text-xs font-semibold text-[color:var(--color-text)]">v{version.version_number} · {version.action.replaceAll('_', ' ')}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[color:var(--color-text-soft)]">{version.title}</p>
                        <p className="mt-2 text-[10px] text-[color:var(--color-text-soft)]">{version.actor_role} · {formatDate(version.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[color:var(--color-text-soft)]">Snapshot versi akan muncul setelah migration hardening diterapkan.</p>
                )}
              </section>

              <section className="rounded-2xl border border-[color:var(--color-border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-soft)]">Jejak review sumber</p>
                    <p className="mt-1 text-xs text-[color:var(--color-text-soft)]">Perubahan klasifikasi dan status verifikasi sumber disimpan append-only untuk audit provenance.</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--color-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--color-text-soft)]">{sourceReviews.length} review</span>
                </div>
                {sourceReviews.length ? (
                  <div className="mt-3 space-y-2">
                    {sourceReviews.slice(0, 12).map(review => (
                      <div key={review.id} className="rounded-xl bg-[color:var(--color-surface-muted)] p-3">
                        <p className="text-xs font-semibold text-[color:var(--color-text)]">
                          {review.from_verification_status} → {review.to_verification_status}
                        </p>
                        {review.source_url_snapshot ? (
                          <a
                            href={review.source_url_snapshot}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block break-all text-[10px] font-semibold text-[color:var(--color-primary)] underline"
                          >
                            {review.source_domain_snapshot || review.source_url_snapshot}
                          </a>
                        ) : (
                          <p className="mt-1 text-[10px] text-[color:var(--color-text-soft)]">URL snapshot tidak tersedia untuk event legacy.</p>
                        )}
                        <p className="mt-1 text-[10px] text-[color:var(--color-text-soft)]">
                          {review.from_source_kind} → {review.to_source_kind} · {formatDate(review.created_at)}
                        </p>
                        {review.note ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[color:var(--color-text)]">{review.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[color:var(--color-text-soft)]">Belum ada perubahan review sumber yang tercatat.</p>
                )}
              </section>

              <section className="rounded-2xl border border-[color:var(--color-border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-soft)]">Jejak editorial</p>
                    <p className="mt-1 text-xs text-[color:var(--color-text-soft)]">Approval, revisi, koreksi, dan penarikan tercatat permanen sebagai audit trail.</p>
                  </div>
                  <span className="rounded-full bg-[color:var(--color-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--color-text-soft)]">{history.length} event</span>
                </div>
                {historyLoading ? (
                  <p className="mt-3 text-xs text-[color:var(--color-text-soft)]">Memuat histori...</p>
                ) : history.length ? (
                  <div className="mt-3 space-y-2">
                    {history.map(event => (
                      <div key={event.id} className="rounded-xl bg-[color:var(--color-surface-muted)] p-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[color:var(--color-text)]">
                          <span>{event.action.replaceAll('_', ' ')}</span>
                          <span className="text-[color:var(--color-text-soft)]">•</span>
                          <span className="text-[color:var(--color-text-soft)]">{event.from_status || '-'} → {event.to_status}</span>
                        </div>
                        <p className="mt-1 text-[10px] font-medium text-[color:var(--color-text-soft)]">{event.actor_role} • {formatDate(event.created_at)}</p>
                        {event.note ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[color:var(--color-text)]">{event.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[color:var(--color-text-soft)]">Belum ada jejak editorial untuk item ini.</p>
                )}
              </section>

              {metrics.top_articles_7d?.length ? (
                <section className="rounded-2xl border border-[color:var(--color-border)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-soft)]">Top artikel 7 hari</p>
                  <div className="mt-3 space-y-2">
                    {metrics.top_articles_7d.slice(0, 5).map((article, index) => (
                      <div key={article.id} className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--color-surface-muted)] p-3 text-xs">
                        <span className="min-w-0 truncate font-semibold text-[color:var(--color-text)]">{index + 1}. {article.title}</span>
                        <span className="shrink-0 text-[color:var(--color-text-soft)]">{article.opens} open</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
