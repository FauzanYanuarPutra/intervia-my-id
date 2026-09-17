'use client';

import { FormEvent, useState } from 'react';

const CATEGORIES = ['Ekonomi', 'Bisnis', 'UMKM', 'Teknologi', 'Keuangan', 'Regulasi', 'Industri', 'Daerah'];

type Props = {
  locale: string;
};

export default function SubmitNewsForm({ locale }: Props) {
  const isId = locale === 'id';
  const [form, setForm] = useState({
    title: '',
    summary: '',
    body: '',
    category: 'Ekonomi',
    article_kind: 'news',
    location: '',
    topics: '',
    source_urls: '',
  });
  const [state, setState] = useState<{ loading: boolean; error: string; success: string }>({
    loading: false,
    error: '',
    success: '',
  });

  const update = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ loading: true, error: '', success: '' });
    try {
      const response = await fetch('/api/news/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          topics: form.topics.split(',').map(value => value.trim()).filter(Boolean),
          source_urls: form.source_urls.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        setState({
          loading: false,
          error:
            response.status === 401
              ? (isId ? 'Silakan masuk ke akun Lajukan sebelum mengirim berita.' : 'Please sign in before submitting news.')
              : payload.error || (isId ? 'Kiriman belum dapat diproses.' : 'Submission could not be processed.'),
          success: '',
        });
        return;
      }
      setForm({
        title: '',
        summary: '',
        body: '',
        category: 'Ekonomi',
        article_kind: 'news',
        location: '',
        topics: '',
        source_urls: '',
      });
      setState({
        loading: false,
        error: '',
        success: payload.message || (isId ? 'Kiriman diterima dan menunggu review editorial.' : 'Submission received for editorial review.'),
      });
    } catch {
      setState({
        loading: false,
        error: isId ? 'Tidak dapat terhubung ke layanan. Coba lagi.' : 'Could not connect to the service. Try again.',
        success: '',
      });
    }
  };

  const inputClass = 'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:ring-emerald-400/10';

  return (
    <form onSubmit={submit} className="grid gap-5">
      {state.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{state.error}</div> : null}
      {state.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">{state.success}</div> : null}

      <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {isId ? 'Judul' : 'Headline'}
        <input required minLength={10} maxLength={180} value={form.title} onChange={event => update('title', event.target.value)} className={inputClass} placeholder={isId ? 'Apa yang terjadi?' : 'What happened?'} />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {isId ? 'Kategori' : 'Category'}
          <select value={form.category} onChange={event => update('category', event.target.value)} className={inputClass}>
            {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {isId ? 'Jenis' : 'Type'}
          <select value={form.article_kind} onChange={event => update('article_kind', event.target.value)} className={inputClass}>
            <option value="news">{isId ? 'Berita' : 'News'}</option>
            <option value="analysis">{isId ? 'Analisis' : 'Analysis'}</option>
            <option value="press_release">{isId ? 'Rilis bisnis' : 'Business release'}</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {isId ? 'Lokasi (opsional)' : 'Location (optional)'}
          <input maxLength={120} value={form.location} onChange={event => update('location', event.target.value)} className={inputClass} placeholder="Tangerang Selatan" />
        </label>
      </div>

      <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {isId ? 'Topik SEO / isu (opsional)' : 'Topics (optional)'}
        <input
          maxLength={300}
          value={form.topics}
          onChange={event => update('topics', event.target.value)}
          className={inputClass}
          placeholder={isId ? 'contoh: qris, inflasi, harga pangan' : 'e.g. qris, inflation, food prices'}
        />
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
          {isId ? 'Pisahkan dengan koma. Maksimal 8 topik; kategori dan jenis konten tidak perlu diulang.' : 'Comma-separated, up to 8 topics. Do not repeat the category or content type.'}
        </span>
      </label>

      <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {isId ? 'Ringkasan' : 'Summary'}
        <textarea required minLength={20} maxLength={1000} rows={3} value={form.summary} onChange={event => update('summary', event.target.value)} className={inputClass} placeholder={isId ? 'Ringkas fakta utama dan kenapa berita ini penting.' : 'Summarize the core facts and why they matter.'} />
      </label>

      <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {isId ? 'Isi berita' : 'Article body'}
        <textarea required minLength={120} maxLength={20000} rows={12} value={form.body} onChange={event => update('body', event.target.value)} className={inputClass} placeholder={isId ? 'Tulis kronologi, fakta, konteks, dan atribusi sumber. Hindari opini yang disamarkan sebagai fakta.' : 'Write the chronology, facts, context, and source attribution. Do not disguise opinion as fact.'} />
      </label>

      <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {isId ? 'URL sumber (satu per baris)' : 'Source URLs (one per line)'}
        <textarea rows={4} value={form.source_urls} onChange={event => update('source_urls', event.target.value)} className={inputClass} placeholder={'https://www.bi.go.id/...\nhttps://www.bps.go.id/...'} />
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
          {isId ? 'Berita dan analisis wajib menyertakan minimal satu sumber. Rilis bisnis boleh tanpa URL sumber, tetapi akan diberi label Rilis Bisnis.' : 'News and analysis require at least one source. Business releases may omit a source URL but are labeled as such.'}
        </span>
      </label>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
        {isId
          ? 'Kiriman tidak langsung tayang. Tim editorial dapat menyetujui, meminta revisi, menolak, mengoreksi, atau menarik publikasi. Opini dan diskusi bebas sebaiknya diposting di Community.'
          : 'Submissions are not published immediately. Editors may approve, request revisions, reject, correct, or retract publication. Open opinion and discussion belong in Community.'}
      </div>

      <button disabled={state.loading} type="submit" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
        {state.loading ? (isId ? 'Mengirim...' : 'Submitting...') : (isId ? 'Kirim untuk review' : 'Submit for review')}
      </button>
    </form>
  );
}
