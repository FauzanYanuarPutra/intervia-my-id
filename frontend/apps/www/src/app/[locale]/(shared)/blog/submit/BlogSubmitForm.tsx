'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NewsRichTextEditor from '../../news/submit/NewsRichTextEditor';

const CATEGORIES = ['UMKM','Bisnis','Supplier','Operasional','Teknologi','AI','Pemasaran','Keuangan','Produksi','Inspirasi'];

export default function BlogSubmitForm() {
  const router = useRouter();
  const [title,setTitle]=useState('');
  const [summary,setSummary]=useState('');
  const [body,setBody]=useState('');
  const [richBody,setRichBody]=useState('');
  const [category,setCategory]=useState('UMKM');
  const [language,setLanguage]=useState('id');
  const [authorName,setAuthorName]=useState('');
  const [topics,setTopics]=useState('');
  const [coverImage,setCoverImage]=useState('');
  const [publicationMode,setPublicationMode]=useState<'review'|'instant'>('review');
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function submit() {
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/blog/submissions', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ title,summary,body,rich_body:richBody,category,language,author_name:authorName,topics,cover_image:coverImage,publication_mode:publicationMode }),
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal menyimpan artikel.');
      setMessage(publicationMode === 'instant' ? 'Artikel berhasil diterbitkan.' : 'Artikel terkirim dan masuk antrean review.');
      if (publicationMode === 'instant') setTimeout(()=>router.push('/blog'),600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan artikel.');
    } finally { setSaving(false); }
  }

  return (
    <main className="page-shell page-rhythm pb-12 pt-6">
      <div className="mb-4"><Link href="/blog" className="text-xs font-bold text-emerald-700">← Kembali ke Blog</Link></div>
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Lajukan Blog</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Tulis artikel</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">Mode Review mengirim artikel ke editor. Mode Instant langsung menerbitkan artikel jika akunmu memiliki hak publikasi dan konten lolos validasi.</p>

        <div className="mt-6 grid gap-4">
          <label className="text-sm font-bold">Judul<input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border p-3 dark:border-white/10 dark:bg-slate-950" /></label>
          <label className="text-sm font-bold">Ringkasan<textarea value={summary} onChange={e=>setSummary(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3 dark:border-white/10 dark:bg-slate-950" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Kategori<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border p-3 dark:border-white/10 dark:bg-slate-950">{CATEGORIES.map(item=><option key={item}>{item}</option>)}</select></label>
            <label className="text-sm font-bold">Bahasa<select value={language} onChange={e=>setLanguage(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border p-3 dark:border-white/10 dark:bg-slate-950"><option value="id">Indonesia</option><option value="en">English</option></select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Nama penulis<input value={authorName} onChange={e=>setAuthorName(e.target.value)} placeholder="Opsional" className="mt-1 min-h-11 w-full rounded-xl border p-3 dark:border-white/10 dark:bg-slate-950" /></label>
            <label className="text-sm font-bold">Topik<input value={topics} onChange={e=>setTopics(e.target.value)} placeholder="supplier, UMKM, produksi" className="mt-1 min-h-11 w-full rounded-xl border p-3 dark:border-white/10 dark:bg-slate-950" /></label>
          </div>
          <label className="text-sm font-bold">Cover image URL<input value={coverImage} onChange={e=>setCoverImage(e.target.value)} placeholder="https://..." className="mt-1 min-h-11 w-full rounded-xl border p-3 dark:border-white/10 dark:bg-slate-950" /></label>

          <div>
            <p className="text-sm font-bold">Publikasi</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={()=>setPublicationMode('review')} className={'rounded-2xl border p-4 text-left ' + (publicationMode==='review'?'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30':'dark:border-white/10')}>
                <p className="font-black">Review dulu</p><p className="mt-1 text-xs text-slate-500">Editor meninjau sebelum artikel masuk Google-indexable state.</p>
              </button>
              <button type="button" onClick={()=>setPublicationMode('instant')} className={'rounded-2xl border p-4 text-left ' + (publicationMode==='instant'?'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30':'dark:border-white/10')}>
                <p className="font-black">Terbit langsung</p><p className="mt-1 text-xs text-slate-500">Untuk akun yang memang diizinkan. Admin tetap dapat menarik/koreksi artikel.</p>
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-bold">Isi artikel</p>
            <NewsRichTextEditor locale={language} value={richBody} onChange={(html,plainText)=>{setRichBody(html);setBody(plainText);}} />
          </div>

          {error ? <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          {message ? <div className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}
          <button disabled={saving} type="button" onClick={()=>void submit()} className="min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-50">{saving?'Menyimpan…':'Kirim artikel'}</button>
        </div>
      </section>
    </main>
  );
}
