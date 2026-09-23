'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Item={id:string;owner_id:string;title:string;summary?:string|null;body:string;cover_image?:string|null;metadata?:Record<string,unknown>;updated_at:string;};
const STATUSES=['pending_review','needs_revision','published','rejected','retracted','all'];

function meta(item:Item){const raw=item.metadata?.blog;return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};}
export default function BlogEditorial(){
  const [status,setStatus]=useState('pending_review');
  const [items,setItems]=useState<Item[]>([]);
  const [selected,setSelected]=useState<Item|null>(null);
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  async function load(next=status){
    setError('');
    try{const r=await fetch('/api/blog/editorial?status='+encodeURIComponent(next));const data=await r.json();if(!r.ok)throw new Error(data.error||'Gagal memuat antrean.');const nextItems=Array.isArray(data.items)?data.items:[];setItems(nextItems);setSelected(nextItems[0]||null);}catch(err){setError(err instanceof Error?err.message:'Gagal memuat antrean.');}
  }
  useEffect(()=>{void load();},[status]);
  async function moderate(action:string){
    if(!selected)return;
    if(action!=='approve'&&action!=='correct'&&!note.trim()){setError('Catatan wajib untuk revisi, penolakan, atau penarikan.');return;}
    const r=await fetch('/api/blog/editorial/'+selected.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,note})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){setError(data.error||'Aksi editorial gagal.');return;}
    setNote('');setMessage('Aksi editorial berhasil.');await load();
  }
  const selectedMeta=selected?meta(selected):{};
  return <main className="page-shell pb-12 pt-6">
    <div className="mx-auto max-w-7xl p-4 lg:p-6">
      <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Lajukan CMS</p><h1 className="mt-1 text-2xl font-black">Editorial Blog</h1><p className="mt-1 text-sm text-slate-500">Review, terbitkan, revisi, atau tarik artikel.</p></div><Link href="/blog" className="text-xs font-bold text-emerald-700">Blog publik</Link></div>
      {error?<div className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>:null}
      {message?<div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>:null}
      <div className="mb-4 flex gap-2 overflow-x-auto">{STATUSES.map(item=><button key={item} type="button" onClick={()=>setStatus(item)} className={'rounded-full border px-3 py-2 text-xs font-bold '+(status===item?'bg-emerald-700 text-white':'')}>{item}</button>)}</div>
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-2xl border bg-white p-3 dark:border-white/10 dark:bg-slate-900"><div className="space-y-2">{items.map(item=><button key={item.id} type="button" onClick={()=>setSelected(item)} className={'w-full rounded-xl border p-3 text-left dark:border-white/10 '+(selected?.id===item.id?'border-emerald-500 bg-emerald-50/60':'') }><p className="text-sm font-black">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.summary}</p><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold dark:bg-white/10">{String(meta(item).editorial_status||item.content_status)}</span></button>)}</div></section>
        <section className="rounded-2xl border bg-white p-5 dark:border-white/10 dark:bg-slate-900">
          {selected?<><div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-500"><span>{String(selectedMeta.category||'UMKM')}</span><span>•</span><span>{String(selectedMeta.author_name||'Lajukan Community')}</span></div><h2 className="mt-2 text-2xl font-black">{selected.title}</h2><p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 dark:bg-white/[0.04]">{selected.summary}</p><div className="mt-4 max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-xl border p-4 text-sm leading-7 dark:border-white/10">{selected.body}</div><textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} placeholder="Catatan editorial…" className="mt-4 w-full rounded-xl border p-3 dark:border-white/10 dark:bg-slate-950" /><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void moderate('approve')} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">Approve & publish</button><button onClick={()=>void moderate('needs_revision')} className="rounded-xl border px-4 py-2 text-xs font-black">Needs revision</button><button onClick={()=>void moderate('reject')} className="rounded-xl border px-4 py-2 text-xs font-black">Reject</button><button onClick={()=>void moderate('retract')} className="rounded-xl border px-4 py-2 text-xs font-black">Retract</button><button onClick={()=>void moderate('correct')} className="rounded-xl border px-4 py-2 text-xs font-black">Correct & republish</button></div></>:<p className="text-sm text-slate-500">Pilih artikel dari antrean.</p>}
        </section>
      </div>
    </div>
  </main>;
}
