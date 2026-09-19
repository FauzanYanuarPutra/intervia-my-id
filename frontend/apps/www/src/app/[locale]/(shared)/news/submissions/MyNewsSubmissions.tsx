'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import NewsRichTextEditor from '../submit/NewsRichTextEditor';

type NewsItem = {
  id: string;
  title: string;
  summary?: string | null;
  body: string;
  tags?: string[] | null;
  content_status: string;
  metadata?: Record<string, unknown>;
  cover_image?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

type SubmissionForm = {
  title: string;
  summary: string;
  body: string;
  rich_body: string;
  category: string;
  article_kind: string;
  location: string;
  cover_image: string;
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

const EMPTY_FORM: SubmissionForm = {
  title: '',
  summary: '',
  body: '',
  rich_body: '',
  category: 'Ekonomi',
  article_kind: 'news',
  location: '',
  cover_image: '',
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fallbackRichBody(value: string): string {
  return value
    .split(/\r?\n\r?\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
}

function formatDate(value?: string | null, locale = 'id-ID'): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusLabel(status: string, isId: boolean): string {
  const labels: Record<string, [string, string]> = {
    pending_review: ['Menunggu review', 'Pending review'],
    needs_revision: ['Perlu revisi', 'Needs revision'],
    published: ['Terbit', 'Published'],
    rejected: ['Ditolak', 'Rejected'],
    retracted: ['Ditarik', 'Retracted'],
  };
  return labels[status]?.[isId ? 0 : 1] || status.replaceAll('_', ' ');
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
  const storedRichBody = text(news.rich_body);

  return {
    title: item.title,
    summary: item.summary || '',
    body: item.body,
    rich_body: storedRichBody || fallbackRichBody(item.body),
    category,
    article_kind: kind,
    location: text(news.location),
    cover_image: text(item.cover_image),
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
  const [uploadingCover, setUploadingCover] = useState(false);
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

  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingCover(true);
    setStatus(current => ({ ...current, error: '', success: '' }));
    try {
      const data = new FormData();
      data.append('image', file);
      const response = await fetch('/api/content/upload-images', {
        method: 'POST',
        body: data,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        urls?: string[];
        files?: Array<{ url?: string }>;
        error?: string;
      };
      const url = payload.urls?.[0] || payload.files?.[0]?.url;
      if (!response.ok || !url) {
        throw new Error(payload.error || (isId ? 'Gagal mengunggah gambar.' : 'Image upload failed.'));
      }
      setForm(current => ({ ...current, cover_image: url }));
    } catch (error) {
      setStatus(current => ({
        ...current,
        error: error instanceof Error
          ? error.message
          : (isId ? 'Gagal mengunggah gambar.' : 'Image upload failed.'),
      }));
    } finally {
      setUploadingCover(false);
    }
  };

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
            rich_body: form.rich_body,
            cover_image: form.cover_image.trim(),
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                  {statusLabel(editorialStatus, isId)}
                </span>
                {selected.created_at ? (
                  <span className="text-xs font-semibold text-slate-500">
                    {isId ? 'Dikirim' : 'Submitted'} {formatDate(selected.created_at, isId ? 'id-ID' : 'en-US')}
                  </span>
                ) : null}
                {selected.updated_at && selected.updated_at !== selected.created_at ? (
                  <span className="text-xs font-semibold text-slate-500">
                    {isId ? 'Diperbarui' : 'Updated'} {formatDate(selected.updated_at, isId ? 'id-ID' : 'en-US')}
                  </span>
                ) : null}
                {selected.published_at ? (
                  <span className="text-xs font-semibold text-slate-500">
                    {isId ? 'Terbit' : 'Published'} {formatDate(selected.published_at, isId ? 'id-ID' : 'en-US')}
                  </span>
                ) : null}
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

              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                <span className="mb-1 block">{isId ? 'Isi berita' : 'Article body'}</span>
                {editable ? (
                  <NewsRichTextEditor
                    value={form.rich_body}
                    locale={locale}
                    onChange={(html, plainText) =>
                      setForm(current => ({
                        ...current,
                        rich_body: html,
                        body: plainText,
                      }))
                    }
                  />
                ) : (
                  <div className="prose prose-slate max-w-none rounded-2xl border border-slate-200 p-4 text-sm font-medium leading-7 dark:prose-invert dark:border-white/10">
                    {form.body}
                  </div>
                )}
              </div>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {isId ? 'Gambar sampul' : 'Cover image'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {isId ? 'Dipakai di kartu berita, halaman artikel, dan distribusi SEO.' : 'Used on news cards, the article page, and SEO distribution.'}
                    </p>
                  </div>
                  {editable ? (
                    <label className="inline-flex min-h-9 cursor-pointer items-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">
                      {uploadingCover ? (isId ? 'Mengunggah...' : 'Uploading...') : (isId ? 'Upload gambar' : 'Upload image')}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingCover}
                        onChange={uploadCover}
                      />
                    </label>
                  ) : null}
                </div>
                {form.cover_image ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                    <img
                      src={form.cover_image}
                      alt={form.title}
                      className="aspect-[16/9] w-full object-cover"
                      loading="lazy"
                      onError={event => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => setForm(current => ({ ...current, cover_image: '' }))}
                        className="w-full border-t border-slate-200 px-3 py-2 text-left text-xs font-bold text-red-600 dark:border-white/10 dark:text-red-300"
                      >
                        {isId ? 'Hapus gambar sampul' : 'Remove cover image'}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500 dark:bg-white/[0.04]">
                    {isId ? 'Belum ada gambar sampul.' : 'No cover image yet.'}
                  </p>
                )}
              </section>

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
