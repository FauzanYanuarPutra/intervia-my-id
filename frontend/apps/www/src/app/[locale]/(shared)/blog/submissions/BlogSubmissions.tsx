'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Item={id:string;title:string;summary?:string|null;content_status:string;metadata?:Record<string,unknown>;updated_at:string;published_at?:string|null;};

function statusOf(item:Item):string {
  const blog=item.metadata&&typeof item.metadata==='object'&&!Array.isArray(item.metadata)?(item.metadata as Record<string,unknown>).blog:null;
  const meta=blog&&typeof blog==='object'?(blog as Record<string,unknown>):{};
  return typeof meta.editorial_status==='string'?meta.editorial_status:item.content_status;
}

export function BlogSubmissions(){
  const [items,setItems]=useState<Item[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>{void fetch('/api/blog/submissions').then(r=>r.json()).then(data=>setItems(Array.isArray(data.items)?data.items:[])).catch(()=>setError('Gagal memuat artikel.'));},[]);
  return <main className="page-shell page-rhythm pb-12 pt-6">
    <div className="mb-4"><Link href="/blog" className="text-xs font-bold text-emerald-700">← Blog</Link></div>
    <section className="rounded-[28px] border bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-8">
      <h1 className="text-2xl font-black text-slate-950 dark:text-white">Artikel saya</h1>
      <p className="mt-1 text-sm text-slate-500">Pantau draft, review, artikel terbit, dan koreksi.</p>
      {error?<p className="mt-4 text-sm font-bold text-red-600">{error}</p>:null}
      <div className="mt-5 grid gap-3">{items.map(item=><article key={item.id} className="rounded-2xl border p-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-black">{item.title}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black dark:bg-white/10">{statusOf(item)}</span></div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
        <p className="mt-2 text-xs text-slate-500">{new Date(item.updated_at).toLocaleString('id-ID')}</p>
      </article>)}</div>
    </section>
  </main>;
}
