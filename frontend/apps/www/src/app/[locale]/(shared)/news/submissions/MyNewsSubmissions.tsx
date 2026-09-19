'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type NewsItem = {
  id: string;
  title: string;
  summary?: string | null;
  body: string;
  tags?: string[] | null;
  content_status: string;
  metadata?: Record<string, unknown>;
  updated_at: string;
};

type SubmissionForm = {
  title: string;
  summary: string;
  body: string;
  category: string;
  article_kind: string;
  location: string;
  topics: string;
  source_urls: string;
};

type LoadResult =
  | { ok: true; items: NewsItem[] }
  | { ok: false; error: string };

const CATEGORIES = [
  'Ekonomi',
  'Bisnis',
  'UMKM',
  'Teknologi',
  'Keuangan',
  'Regulasi',
  'Industri',
  'Daerah',
];

const STATUS_LABELS: Record<string, { id: string; en: string }> = {
  pending_review: { id: 'Menunggu review', en: 'Pending review' },
  needs_revision: { id: 'Perlu revisi', en: 'Needs revision' },
  published: { id: 'Terbit', en: 'Published' },
  rejected: { id: 'Ditolak', en: 'Rejected' },
  retracted: { id: 'Ditarik', en: 'Retracted' },
};

function statusLabel(status: string, isId: boolean) {
  return STATUS_LABELS[status]?.[isId ? 'id' : 'en'] || status.replaceAll('_', ' ');
}

const EMPTY_FORM: SubmissionForm = {
  title: '',
  summary: '',
  body: '',
  category: 'Ekonomi',
  article_kind: 'news',
  location: '',
  topics: '',
  source_urls: '',
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function urls(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function topics(value: unknown, category: string, kind: string): string[] {
  const reserved = new Set([
    'news',
    'analysis',
    'press_release',
    category.toLowerCase(),
    kind.toLowerCase(),
  ]);
  return urls(value).filter(topic => !reserved.has(topic.toLowerCase()));
}

export function submissionFormFromItem(item: NewsItem): SubmissionForm {
  const news = record(record(item.metadata).news);
  const category = text(news.category) || 'Ekonomi';
  const kind = text(news.article_kind) || 'news';

  return {
    title: item.title,
    summary: item.summary || '',
    body: item.body,
    category,
    article_kind: kind,
    location: text(news.location),
    topics: topics(item.tags, category, kind).join(', '),
    source_urls: urls(news.source_urls).join('\n'),
  };
}

async function requestSubmissions(isId: boolean): Promise<LoadResult> {
  const response = await fetch('/api/news/submissions', { cache: 'no-store' });
  const payload = (await response.json().catch(() => ({}))) as {
    items?: NewsItem[];
    error?: string;
  };

  if (!response.ok) {
    return {
      ok: false,
      error:
        response.status === 401
          ? isId
            ? 'Silakan masuk untuk melihat kiriman.'
            : 'Please sign in to view submissions.'
          : payload.error ||
            (isId ? 'Gagal memuat kiriman.' : 'Could not load submissions.'),
    };
  }

  return {
    ok: true,
    items: Array.isArray(payload.items) ? payload.items : [],
  };
}

export default function MyNewsSubmissions({ locale }: { locale: string }) {
  const isId = locale === 'id';
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<SubmissionForm>(EMPTY_FORM);
  const [status, setStatus] = useState({
    loading: true,
    saving: false,
    error: '',
    success: '',
  });

  const selected = useMemo(
    () => items.find(item => item.id === selectedId) || items[0] || null,
    [items, selectedId],
  );
  const meta = selected ? record(record(selected.metadata).news) : {};
  const editorialStatus =
    text(meta.editorial_status) || selected?.content_status || '';
  const editable = Boolean(
    selected &&
      ['pending_review', 'needs_revision', 'rejected'].includes(editorialStatus),
  );

  useEffect(() => {
    let active = true;

    void requestSubmissions(isId)
      .then(result => {
        if (!active) return;
        if (!result.ok) {
          setItems([]);
          setSelectedId('');
          setForm(EMPTY_FORM);
          setStatus({
            loading: false,
            saving: false,
            error: result.error,
            success: '',
          });
          return;
        }

        const first = result.items[0] || null;
        setItems(result.items);
        setSelectedId(first?.id || '');
        setForm(first ? submissionFormFromItem(first) : EMPTY_FORM);
        setStatus({
          loading: false,
          saving: false,
          error: '',
          success: '',
        });
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setSelectedId('');
        setForm(EMPTY_FORM);
        setStatus({
          loading: false,
          saving: false,
          error: isId
            ? 'Tidak dapat memuat kiriman.'
            : 'Could not load submissions.',
          success: '',
        });
      });

    return () => {
      active = false;
    };
  }, [isId]);

  const reload = async (preferredId?: string) => {
    setStatus(current => ({ ...current, loading: true, error: '' }));
    const result = await requestSubmissions(isId);

    if (!result.ok) {
      setItems([]);
      setSelectedId('');
      setForm(EMPTY_FORM);
      setStatus({
        loading: false,
        saving: false,
        error: result.error,
        success: '',
      });
      return;
    }

    const nextSelected =
      result.items.find(item => item.id === preferredId) ||
      result.items[0] ||
      null;

    setItems(result.items);
    setSelectedId(nextSelected?.id || '');
    setForm(nextSelected ? submissionFormFromItem(nextSelected) : EMPTY_FORM);
    setStatus(current => ({
      ...current,
      loading: false,
      saving: false,
      error: '',
    }));
  };

  const chooseItem = (item: NewsItem) => {
    setSelectedId(item.id);
    setForm(submissionFormFromItem(item));
    setStatus(current => ({ ...current, error: '', success: '' }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !editable) return;

    setStatus(current => ({
      ...current,
      saving: true,
      error: '',
      success: '',
    }));

    try {
      const response = await fetch(
        `/api/news/submissions/${encodeURIComponent(selected.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            topics: form.topics
              .split(',')
              .map(value => value.trim())
              .filter(Boolean),
            source_urls: form.source_urls
              .split(/\r?\n/)
              .map(value => value.trim())
              .filter(Boolean),
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setStatus(current => ({
          ...current,
          saving: false,
          error:
            payload.error ||
            (isId ? 'Gagal menyimpan revisi.' : 'Could not save revision.'),
        }));
        return;
      }

      await reload(selected.id);
      setStatus(current => ({
        ...current,
        saving: false,
        success: isId
          ? 'Revisi dikirim kembali ke antrean editorial.'
          : 'Revision resubmitted to the editorial queue.',
      }));
    } catch {
      setStatus(current => ({
        ...current,
        saving: false,
        error: isId
          ? 'Tidak dapat menyimpan revisi.'
          : 'Could not save revision.',
      }));
    }
  };

  const inputClass =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white';

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-[26px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <h2 className="font-bold text-slate-950 dark:text-white">
          {isId ? 'Kiriman saya' : 'My submissions'}
        </h2>
        {status.loading ? (
          <p className="mt-3 text-sm text-slate-500">Memuat...</p>
        ) : null}
        {status.error ? (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-200">
            {status.error}
          </p>
        ) : null}
        <div className="mt-3 grid gap-2">
          {items.map(item => {
            const news = record(record(item.metadata).news);
            const state = text(news.editorial_status) || item.content_status;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseItem(item)}
                className={`rounded-2xl border p-3 text-left ${
                  selected?.id === item.id
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-400/10'
                    : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.title}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
{statusLabel(state, isId)}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-6">
        {!selected ? (
          <p className="text-sm text-slate-500">
            {isId ? 'Belum ada kiriman.' : 'No submissions yet.'}
          </p>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
{statusLabel(editorialStatus, isId)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                <span>{isId ? 'Diperbarui' : 'Updated'}: {new Intl.DateTimeFormat(isId ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.updated_at))}</span>
                {text(meta.submitted_at) ? <span>• {isId ? 'Dikirim' : 'Submitted'}: {new Intl.DateTimeFormat(isId ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(text(meta.submitted_at)))}</span> : null}
              </div>
              {text(meta.review_note) ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                  <strong>{isId ? 'Catatan editor:' : 'Editor note:'}</strong>{' '}
                  {text(meta.review_note)}
                </div>
              ) : null}
              {status.success ? (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                  {status.success}
                </div>
              ) : null}
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {['pending_review','needs_revision','published','rejected','retracted'].map(step => (
                <div key={step} className={`rounded-xl border px-3 py-2 ${step === editorialStatus ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-400/10' : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{statusLabel(step, isId)}</p>
                </div>
              ))}
            </div>
            <form onSubmit={save} className="grid gap-4">
              <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {isId ? 'Judul' : 'Headline'}
                <input
                  disabled={!editable}
                  value={form.title}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isId ? 'Kategori' : 'Category'}
                  <select
                    disabled={!editable}
                    value={form.category}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {CATEGORIES.map(value => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isId ? 'Jenis' : 'Type'}
                  <select
                    disabled={!editable}
                    value={form.article_kind}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        article_kind: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="news">Berita</option>
                    <option value="analysis">Analisis</option>
                    <option value="press_release">Rilis bisnis</option>
                  </select>
                </label>

                <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isId ? 'Lokasi' : 'Location'}
                  <input
                    disabled={!editable}
                    value={form.location}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {isId ? 'Topik' : 'Topics'}
                <input
                  disabled={!editable}
                  value={form.topics}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      topics: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="qris, inflasi, harga pangan"
                />
              </label>

              <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {isId ? 'Ringkasan' : 'Summary'}
                <textarea
                  disabled={!editable}
                  rows={3}
                  value={form.summary}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {isId ? 'Isi' : 'Body'}
                <textarea
                  disabled={!editable}
                  rows={12}
                  value={form.body}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {isId ? 'URL sumber' : 'Source URLs'}
                <textarea
                  disabled={!editable}
                  rows={4}
                  value={form.source_urls}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      source_urls: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              {editable ? (
                <button
                  disabled={status.saving}
                  className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {status.saving
                    ? isId
                      ? 'Menyimpan...'
                      : 'Saving...'
                    : isId
                      ? 'Kirim revisi'
                      : 'Resubmit revision'}
                </button>
              ) : (
                <p className="text-xs font-semibold text-slate-500">
                  {isId
                    ? 'Item ini tidak dapat diedit pada status sekarang.'
                    : 'This item cannot be edited in its current state.'}
                </p>
              )}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
