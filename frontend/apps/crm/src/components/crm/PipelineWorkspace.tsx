'use client';
import { Card, EmptyState, PageHeader, StatusBadge } from 'lajukan-ui';
import type { CrmLead } from '@/lib/api';
import { groupPipelineStage, PIPELINE_COLUMNS } from './pipeline';
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function money(cents: number, currency='IDR'): string { return new Intl.NumberFormat('id-ID',{style:'currency',currency,maximumFractionDigits:0}).format(Math.max(0,cents)/100); }
function date(value: string): string { const parsed=new Date(value); return Number.isNaN(parsed.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(parsed); }
export function PipelineWorkspace({leads}:{leads:CrmLead[]}) {
  return <div className="space-y-5">
    <div className="space-y-2"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">CRM Pipeline</p><PageHeader title="Follow-up prospek sampai jadi deal." description="Bahasa dibuat sederhana agar agent langsung tahu siapa yang harus dihubungi dulu." /></div>
    <div className="grid gap-4 xl:grid-cols-5">
      {PIPELINE_COLUMNS.map(column=>{const items=leads.filter(lead=>groupPipelineStage(lead.stage)===column.id);return <Card key={column.id} className="min-h-[420px] p-3">
        <div className="mb-3 rounded-2xl bg-[color:var(--color-surface-muted)] p-3"><div className="flex items-center justify-between"><p className="text-sm font-bold">{column.label}</p><StatusBadge tone={column.id==='completed'?'success':'neutral'}>{items.length}</StatusBadge></div><p className="mt-1 text-xs text-[color:var(--color-text-soft)]">{column.help}</p></div>
        <div className="space-y-3">{items.map(lead=><div key={lead.id} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-bold">{lead.requester_name||lead.name}</p>{column.id==='negotiation'||column.id==='locked'?<StatusBadge tone="warning">Hot Lead</StatusBadge>:null}</div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--color-text-soft)]">{text(lead.metadata?.listing_title)||lead.sector||'Listing yang dilihat'}</p><div className="mt-3 flex items-center justify-between text-xs"><span className="font-bold text-emerald-700">{money(lead.value_cents||0,lead.currency||'IDR')}</span><span className="text-[color:var(--color-text-soft)]">{date(lead.updated_at)}</span></div></div>)}{!items.length?<EmptyState title="Kosong" description="Belum ada lead di tahap ini." />:null}</div>
      </Card>})}
    </div>
  </div>;
}
