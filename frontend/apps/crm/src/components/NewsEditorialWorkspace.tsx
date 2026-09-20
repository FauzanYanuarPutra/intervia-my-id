'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { newsApi } from '@/lib/api';

type NewsItem = {
  id: string;
  owner_id: string;
  slug?: string | null;
  title: string;
  summary?: string | null;
  body: string;
  cover_image?: string | null;
  metadata?: Record<string, unknown>;
  content_status: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
};

type Metrics = {
  queue?: Array<{ key: string; value: number }>;
  published_24h?: number;
  published_7d?: number;
  scheduled?: number;
  stale_review_24h?: number;
  avg_review_minutes?: number | null;
  sources?: { total?: number; verified?: number; flagged?: number };
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID');
}

function localDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
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

function editorialStatus(item: NewsItem): string {
  const meta = record(record(item.metadata).news);
  return (
    stringValue(meta.editorial_status) ||
    (item.content_status === 'active'
      ? 'published'
      : item.content_status === 'archived'
        ? 'rejected'
        : 'pending_review')
  );
}

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

function statusTone(value: string): string {
  if (value === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value === 'rejected' || value === 'retracted') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (value === 'needs_revision') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

export default function NewsEditorialWorkspace({
  accessToken,
}: {
  accessToken: string;
}) {
  const [status, setStatus] = useState('pending_review');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [businessImpact, setBusinessImpact] = useState('');
  const [factCheck, setFactCheck] = useState<'pending' | 'verified' | 'not_required'>('pending');
  const [legalReview, setLegalReview] = useState<'pending' | 'approved' | 'not_required'>('not_required');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [sensitivity, setSensitivity] = useState<'normal' | 'high'>('normal');
  const [publishAt, setPublishAt] = useState('');
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [history, setHistory] = useState<EditorialEvent[]>([]);
  const [versions, setVersions] = useState<NewsVersion[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [sourceBusy, setSourceBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = useMemo(
    () => items.find(item => item.id === selectedId) || items[0] || null,
    [items, selectedId],
  );

  const visibleItems = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return items;
    return items.filter(item => {
      const meta = record(record(item.metadata).news);
      return [
        item.title,
        item.summary || '',
        item.owner_id,
        stringValue(meta.category),
        stringValue(meta.location),
        stringValue(meta.article_kind),
      ]
        .join(' ')
        .toLowerCase()
        .includes(clean);
    });
  }, [items, query]);

  const queueCount = useCallback(
    (key: string) => metrics.queue?.find(item => item.key === key)?.value ?? 0,
    [metrics.queue],
  );

  const applySelected = useCallback((item: NewsItem | null) => {
    const meta = item ? record(record(item.metadata).news) : {};
    const kind = stringValue(meta.article_kind) || 'news';
    const fact = stringValue(meta.fact_check_status);
    const legal = stringValue(meta.legal_review_status);
    const editorialPriority = stringValue(meta.editorial_priority);
    const selectedSensitivity = stringValue(meta.sensitivity);

    setBusinessImpact(stringValue(meta.business_impact));
    setFactCheck(
      fact === 'verified' || fact === 'not_required'
        ? fact
        : kind === 'press_release'
          ? 'not_required'
          : 'pending',
    );
    setLegalReview(
      legal === 'approved' || legal === 'pending' || legal === 'not_required'
        ? legal
        : selectedSensitivity === 'high'
          ? 'pending'
          : 'not_required',
    );
    setPriority(
      editorialPriority === 'low' ||
        editorialPriority === 'high' ||
        editorialPriority === 'urgent'
        ? editorialPriority
        : 'normal',
    );
    setSensitivity(selectedSensitivity === 'high' ? 'high' : 'normal');
    const scheduled = stringValue(meta.scheduled_for);
    setPublishAt(scheduled ? localDateTime(scheduled) : '');
    setSources([]);
    setHistory([]);
    setVersions([]);
    setNote('');
    setError('');
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const payload = await newsApi.metrics(accessToken);
      setMetrics(record(payload) as Metrics);
    } catch {
      setMetrics({});
    }
  }, [accessToken]);

  const loadHistory = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const payload = await newsApi.history(accessToken, id);
        const value = record(payload);
        setHistory(Array.isArray(value.items) ? (value.items as EditorialEvent[]) : []);
        setVersions(Array.isArray(value.versions) ? (value.versions as NewsVersion[]) : []);
        setSources(Array.isArray(value.sources) ? (value.sources as NewsSource[]) : []);
      } catch {
        setHistory([]);
        setVersions([]);
        setSources([]);
      }
    },
    [accessToken],
  );

  const loadQueue = useCallback(
    async (nextStatus = status, preserveId = selectedId) => {
      setLoading(true);
      setError('');
      try {
        const payload = await newsApi.queue(accessToken, nextStatus);
        const value = record(payload);
        const nextItems = Array.isArray(value.items) ? (value.items as NewsItem[]) : [];
        const nextSelected = nextItems.find(item => item.id === preserveId) || nextItems[0] || null;
        setItems(nextItems);
        setSelectedId(nextSelected?.id || '');
        applySelected(nextSelected);
        if (nextSelected) void loadHistory(nextSelected.id);
      } catch (err) {
        setItems([]);
        setSelectedId('');
        applySelected(null);
        setError(err instanceof Error ? err.message : 'Antrean News tidak dapat dimuat.');
      } finally {
        setLoading(false);
      }
    },
    [accessToken, applySelected, loadHistory, selectedId, status],
  );

  useEffect(() => {
    void loadQueue(status, selectedId);
  }, [status]);

  useEffect(() => {
    void loadMetrics();
    const timer = window.setInterval(() => void loadMetrics(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadMetrics]);

  useEffect(() => {
    if (!selected) return;
    applySelected(selected);
    void loadHistory(selected.id);
  }, [selected?.id]);

  const updateSource = async (
    source: NewsSource,
    verification_status: NewsSource['verification_status'],
  ) => {
    setSourceBusy(source.id);
    setError('');
    try {
      const payload = await newsApi.updateSource(accessToken, selected?.id || '', source.id, {
        verification_status,
      });
      const value = record(payload);
      if (value.id) {
        setSources(current =>
          current.map(item => (item.id === source.id ? (value as unknown as NewsSource) : item)),
        );
      } else if (selected) {
        await loadHistory(selected.id);
      }
      setSuccess(
        verification_status === 'verified'
          ? 'Sumber berhasil diverifikasi.'
          : 'Status sumber berhasil diperbarui.',
      );
      void loadMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui sumber.');
    } finally {
      setSourceBusy('');
    }
  };

  const moderate = async (
    action: 'approve' | 'needs_revision' | 'reject' | 'retract' | 'correct',
  ) => {
    if (!selected) return;
    const requiresNote = action !== 'approve';
    if (requiresNote && !note.trim()) {
      setError('Catatan editor wajib untuk revisi, penolakan, koreksi, atau penarikan publikasi.');
      return;
    }

    const meta = record(record(selected.metadata).news);
    const kind = stringValue(meta.article_kind) || 'news';
    const verifiedSource = sources.some(
      source => source.verification_status === 'verified' && isSafeUrl(source.source_url),
    );

    if (action === 'approve' || action === 'correct') {
      if (kind !== 'press_release' && factCheck !== 'verified') {
        setError('Fact-check harus Verified sebelum publikasi.');
        return;
      }
      if (sensitivity === 'high' && legalReview !== 'approved') {
        setError('Konten sensitivitas tinggi membutuhkan Legal Review = Approved.');
        return;
      }
      if (kind !== 'press_release' && !verifiedSource) {
        setError('Minimal satu sumber harus Verified sebelum publikasi.');
        return;
      }
    }

    setActing(true);
    setError('');
    setSuccess('');
    try {
      await newsApi.moderate(accessToken, selected.id, {
        action,
        note: note.trim() || undefined,
        business_impact: businessImpact.trim() || undefined,
        publish_at:
          action === 'approve' && publishAt
            ? new Date(publishAt).toISOString()
            : undefined,
        fact_check_status: factCheck,
        legal_review_status: legalReview,
        editorial_priority: priority,
        sensitivity,
      });
      setSuccess(
        action === 'approve'
          ? 'Berita berhasil di-approve dan diterbitkan sesuai jadwal.'
          : 'Keputusan editorial berhasil disimpan.',
      );
      setNote('');
      await loadQueue(status, selected.id);
      void loadMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses berita.');
    } finally {
      setActing(false);
    }
  };

  const meta = selected ? record(record(selected.metadata).news) : {};
  const category = stringValue(meta.category) || '-';
  const kind = stringValue(meta.article_kind) || 'news';
  const location = stringValue(meta.location) || '-';
  const currentStatus = selected ? editorialStatus(selected) : status;
  const needsSource = kind !== 'press_release';
  const verifiedSources = sources.filter(
    source => source.verification_status === 'verified' && isSafeUrl(source.source_url),
  ).length;
  const publicationReady =
    (kind === 'press_release' || factCheck === 'verified') &&
    (sensitivity !== 'high' || legalReview === 'approved') &&
    (!needsSource || verifiedSources > 0);

  const metricsCards = [
    ['Menunggu review', queueCount('pending_review'), 'border-sky-200 bg-sky-50'],
    ['Perlu revisi', queueCount('needs_revision'), 'border-amber-200 bg-amber-50'],
    ['Terbit 24 jam', metrics.published_24h ?? 0, 'border-emerald-200 bg-emerald-50'],
    ['Queue >24 jam', metrics.stale_review_24h ?? 0, 'border-rose-200 bg-rose-50'],
  ] as const;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">CRM • News Editorial</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.05em] text-slate-950 sm:text-3xl">
              Approve News di sini
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Semua kiriman dari halaman Submit News masuk ke antrean ini dulu. Belum akan tampil di publik sampai lolos review editorial.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={process.env.NEXT_PUBLIC_CMS_URL || '/news'}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Buka CMS lengkap
            </a>
            <button
              type="button"
              onClick={() => {
                void loadQueue(status, selectedId);
                void loadMetrics();
              }}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              disabled={loading || acting}
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricsCards.map(([label, value, tone]) => (
          <div key={label} className={'rounded-2xl border p-4 ' + tone}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{loading ? '…' : value}</p>
          </div>
        ))}
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {success}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            ['pending_review', 'Menunggu'],
            ['needs_revision', 'Revisi'],
            ['published', 'Terbit'],
            ['rejected', 'Ditolak'],
            ['retracted', 'Ditarik'],
            ['all', 'Semua'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={
                status === value
                  ? 'rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white'
                  : 'rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50'
              }
            >
              {label}
              {['pending_review', 'needs_revision', 'published'].includes(value)
                ? ' · ' + queueCount(value)
                : ''}
            </button>
          ))}
          <label className="ml-auto flex min-w-[260px] flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3">
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Cari judul, owner, kategori, lokasi..."
              className="min-h-10 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3 px-2">
            <div>
              <p className="text-sm font-black text-slate-950">Antrean editorial</p>
              <p className="text-xs font-semibold text-slate-500">{visibleItems.length} item terlihat</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
              {statusLabel(status)}
            </span>
          </div>
          <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(item => (
                  <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : visibleItems.length ? (
              visibleItems.map(item => {
                const itemStatus = editorialStatus(item);
                const itemMeta = record(record(item.metadata).news);
                const active = item.id === selected?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={
                      'w-full rounded-2xl border p-3 text-left transition ' +
                      (active
                        ? 'border-emerald-300 bg-emerald-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50')
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-black text-slate-950">{item.title}</p>
                      <span className={'shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ' + statusTone(itemStatus)}>
                        {statusLabel(itemStatus)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                      {item.summary || item.body}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-400">
                      <span>{stringValue(itemMeta.category) || 'Ekonomi'}</span>
                      <span>•</span>
                      <span>{stringValue(itemMeta.article_kind) || 'news'}</span>
                      <span>•</span>
                      <span>{formatDate(item.updated_at)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-sm font-black text-slate-900">
                  {status === 'pending_review' ? 'Belum ada News yang menunggu approval.' : 'Antrean kosong.'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Kiriman baru akan masuk ke status pending review setelah user berhasil submit.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          {selected ? (
            <div className="space-y-5 p-4 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className={'rounded-full border px-2.5 py-1 text-[10px] font-black ' + statusTone(currentStatus)}>
                      {statusLabel(currentStatus)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                      {kind}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                      {category}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{selected.title}</h2>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Owner: {selected.owner_id} • Lokasi: {location} • Dikirim: {formatDate(selected.created_at)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Publication readiness</p>
                  <p className={'mt-1 text-sm font-black ' + (publicationReady ? 'text-emerald-700' : 'text-amber-700')}>
                    {publicationReady ? 'Siap dipublikasi' : 'Belum siap'}
                  </p>
                  {needsSource ? (
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">{verifiedSources} sumber verified</p>
                  ) : null}
                </div>
              </div>

              {selected.cover_image ? (
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <img src={selected.cover_image} alt="" className="max-h-[330px] w-full object-cover" />
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Ringkasan</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{selected.summary || '-'}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Isi berita</p>
                  <div className="mt-2 max-h-[240px] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {selected.body}
                  </div>
                </article>
              </div>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-950">Sources & verifikasi</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      News/Analysis membutuhkan minimal satu sumber verified sebelum approval.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">
                    {sources.filter(source => source.verification_status === 'verified').length} verified
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {sources.length ? (
                    sources.map(source => (
                      <div key={source.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            {isSafeUrl(source.source_url) ? (
                              <a
                                href={source.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-xs font-bold text-emerald-700 hover:underline"
                              >
                                {source.source_url}
                              </a>
                            ) : (
                              <p className="break-all text-xs font-bold text-slate-700">{source.source_url}</p>
                            )}
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              {source.source_domain || '-'} • {source.source_kind}
                            </p>
                          </div>
                          <span className={'w-fit rounded-full border px-2.5 py-1 text-[10px] font-black ' + statusTone(source.verification_status === 'verified' ? 'published' : source.verification_status === 'rejected' ? 'rejected' : 'needs_revision')}>
                            {source.verification_status}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(['verified', 'broken', 'rejected'] as const).map(next => (
                            <button
                              key={next}
                              type="button"
                              disabled={sourceBusy === source.id || acting}
                              onClick={() => void updateSource(source, next)}
                              className={
                                next === 'verified'
                                  ? 'rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 disabled:opacity-50'
                                  : next === 'broken'
                                    ? 'rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700 disabled:opacity-50'
                                    : 'rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-700 disabled:opacity-50'
                              }
                            >
                              {sourceBusy === source.id && next === 'verified' ? 'Menyimpan…' : next}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
                      Belum ada source reference untuk item ini.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="text-xs font-bold text-slate-500">
                    Fact-check
                    <select value={factCheck} onChange={event => setFactCheck(event.target.value as typeof factCheck)} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="not_required">Tidak perlu</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Legal review
                    <select value={legalReview} onChange={event => setLegalReview(event.target.value as typeof legalReview)} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                      <option value="not_required">Tidak perlu</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Priority
                    <select value={priority} onChange={event => setPriority(event.target.value as typeof priority)} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Sensitivitas
                    <select value={sensitivity} onChange={event => setSensitivity(event.target.value as typeof sensitivity)} className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-xs font-bold text-slate-500">
                  Jadwal publikasi (opsional)
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={event => setPublishAt(event.target.value)}
                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800"
                  />
                </label>
                <label className="mt-3 block text-xs font-bold text-slate-500">
                  Dampak bisnis (opsional)
                  <textarea
                    value={businessImpact}
                    onChange={event => setBusinessImpact(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
                    placeholder="Catatan konteks/dampak yang perlu diketahui editor lain."
                  />
                </label>
                <label className="mt-3 block text-xs font-bold text-slate-500">
                  Catatan editorial
                  <textarea
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    rows={4}
                    maxLength={4000}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
                    placeholder={currentStatus === 'pending_review' ? 'Catatan wajib untuk revisi/tolak. Untuk approve boleh dikosongkan.' : 'Jelaskan keputusan secara faktual agar dapat diaudit.'}
                  />
                </label>

                {!publicationReady && (status === 'pending_review' || status === 'needs_revision') ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                    {!factCheck && kind !== 'press_release'
                      ? 'Lengkapi fact-check.'
                      : kind !== 'press_release' && factCheck !== 'verified'
                        ? 'Fact-check harus Verified.'
                        : sensitivity === 'high' && legalReview !== 'approved'
                          ? 'Legal review harus Approved untuk sensitivitas tinggi.'
                          : needsSource && verifiedSources === 0
                            ? 'Verifikasi minimal satu sumber terlebih dahulu.'
                            : 'Masih ada gate editorial yang belum terpenuhi.'}
                  </div>
                ) : null}

                {sensitivity === 'high' ? (
                  <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold leading-5 text-sky-800">
                    Konten sensitivitas tinggi memerlukan legal approval dan, untuk News/Analysis, independent source review oleh reviewer lain.
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {currentStatus === 'pending_review' || currentStatus === 'needs_revision' ? (
                    <>
                      <button
                        type="button"
                        disabled={acting || !publicationReady}
                        onClick={() => void moderate('approve')}
                        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {acting ? 'Menyimpan…' : publishAt ? 'Approve & jadwalkan' : 'Approve & publish'}
                      </button>
                      <button
                        type="button"
                        disabled={acting || !note.trim()}
                        onClick={() => void moderate('needs_revision')}
                        className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Minta revisi
                      </button>
                      <button
                        type="button"
                        disabled={acting || !note.trim()}
                        onClick={() => void moderate('reject')}
                        className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Tolak
                      </button>
                    </>
                  ) : null}
                  {currentStatus === 'published' ? (
                    <>
                      <button
                        type="button"
                        disabled={acting || !note.trim() || !publicationReady}
                        onClick={() => void moderate('correct')}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Catat koreksi
                      </button>
                      <button
                        type="button"
                        disabled={acting || !note.trim()}
                        onClick={() => void moderate('retract')}
                        className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Tarik publikasi
                      </button>
                    </>
                  ) : null}
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-black text-slate-950">Jejak editorial</h3>
                  <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto">
                    {history.length ? history.map(event => (
                      <div key={event.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-slate-800">{event.action}</p>
                          <p className="text-[10px] font-semibold text-slate-400">{formatDate(event.created_at)}</p>
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">
                          {event.actor_role} • {event.from_status || '-'} → {event.to_status}
                        </p>
                        {event.note ? <p className="mt-2 text-xs leading-5 text-slate-600">{event.note}</p> : null}
                      </div>
                    )) : <p className="text-xs font-semibold text-slate-400">Belum ada jejak editorial.</p>}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-black text-slate-950">Version history</h3>
                  <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto">
                    {versions.length ? versions.map(version => (
                      <div key={version.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-slate-800">v{version.version_number} • {version.action}</p>
                          <p className="text-[10px] font-semibold text-slate-400">{formatDate(version.created_at)}</p>
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">{version.actor_role} • {version.editorial_status || '-'}</p>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-700">{version.title}</p>
                      </div>
                    )) : <p className="text-xs font-semibold text-slate-400">Belum ada version history.</p>}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[680px] place-items-center p-8 text-center">
              <div>
                <p className="text-lg font-black text-slate-950">Pilih News dari antrean</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                  Submit News dari website tidak langsung terbit. Pilih item di sebelah kiri untuk melihat isi, sumber, readiness, dan tombol approval.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
