'use client';
import { useState } from 'react';
import { Button,Drawer,Input,StatusBadge } from 'lajukan-ui';
import { buildExploreFilterChanges,countExploreFilters,type ExploreFilterState } from '@/lib/search/exploreFilters';
import type { GlobalSearchSort } from '@/lib/search/globalSearch';
export function ExploreFilterDrawer({onClose,value,onApply,onClear,isId}:{onClose:()=>void;value:ExploreFilterState;onApply:(changes:Record<string,string|null>)=>void;onClear:()=>void;isId:boolean}){
  const [draft,setDraft]=useState(value);
  const count=countExploreFilters(value);
  return <Drawer open onClose={onClose} title={isId?'Filter pencarian':'Search filters'} description={isId?'Saring hasil tanpa kehilangan kata kunci atau kategori yang sedang aktif.':'Refine results without losing the current query or category.'} footer={<div className="flex w-full gap-2"><Button variant="secondary" className="flex-1" onClick={()=>{onClear();onClose()}} disabled={count===0}>{isId?'Hapus semua':'Clear all'}</Button><Button className="flex-1" onClick={()=>{onApply(buildExploreFilterChanges(draft));onClose()}}>{isId?'Terapkan':'Apply'}</Button></div>}>
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[color:var(--color-text)]">{isId?'Filter aktif':'Active filters'}</p><StatusBadge tone={count?'info':'neutral'}>{count}</StatusBadge></div>
      <Input label={isId?'Lokasi':'Location'} value={draft.location} onChange={event=>setDraft(current=>({...current,location:event.target.value}))} placeholder={isId?'Contoh: Bandung':'Example: Bandung'} description={isId?'Kosongkan untuk mencari tanpa nama lokasi tertentu.':'Leave blank to search without a named location.'}/>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-[color:var(--color-text)]">{isId?'Radius':'Radius'}</span><select value={draft.distanceKm??''} onChange={event=>setDraft(current=>({...current,distanceKm:event.target.value?Number(event.target.value):null}))} className="min-h-[var(--touch-target)] w-full rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]"><option value="">{isId?'Semua jarak':'Any distance'}</option>{[5,10,25,50,100].map(value=><option key={value} value={value}>{value} km</option>)}</select></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-[color:var(--color-text)]">{isId?'Urutkan':'Sort'}</span><select value={draft.sort} onChange={event=>setDraft(current=>({...current,sort:event.target.value as GlobalSearchSort}))} className="min-h-[var(--touch-target)] w-full rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]"><option value="relevance">{isId?'Paling relevan':'Most relevant'}</option><option value="latest">{isId?'Terbaru':'Newest'}</option><option value="nearest">{isId?'Terdekat':'Nearest'}</option></select></label>
    </div>
  </Drawer>;
}
