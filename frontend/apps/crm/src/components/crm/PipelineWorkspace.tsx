'use client';

import { useEffect, useState } from 'react';
import { Card, EmptyState, PageHeader, StatusBadge } from 'lajukan-ui';
import { useAuth } from '@/context/AuthContext';
import { leadApi, type CrmLead } from '@/lib/api';
import { groupPipelineStage, PIPELINE_COLUMNS } from './pipeline';

function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function money(cents: number, currency='IDR'): string {
  return new Intl.NumberFormat('id-ID',{style:'currency',currency,maximumFractionDigits:0}).format(Math.max(0,cents)/100);
}
function date(value: string): string {
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(parsed);
}
const STAGE_OPTIONS = ['new', 'qualified', 'negotiation', 'contract', 'won', 'lost'];

export function PipelineWorkspace({leads}:{leads:CrmLead[]}) {
  const { accessToken } = useAuth();
  const [items, setItems] = useState(leads);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => setItems(leads), [leads]);

  async function changeStage(lead: CrmLead, stage: string) {
    if (!accessToken || !stage || stage === lead.stage || busyId) return;
    setBusyId(lead.id);
    setNotice('');
    try {
      const response = await leadApi.updateStage(accessToken, lead.id, stage);
      const updated = response.lead;
      setItems(current => current.map(item => item.id === lead.id ? updated : item));
      setNotice(`Stage ${updated.name || lead.name} diubah ke ${updated.stage}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Stage lead gagal diperbarui.');
    } finally {
      setBusyId('');
    }
  }

  return <div className="space-y-4">
    <PageHeader title="Follow-up prospek sampai deal." description="Pilih stage langsung dari kartu lead." />
    {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0">
      {PIPELINE_COLUMNS.map(column=> {
        const columnItems=items.filter(lead=>groupPipelineStage(lead.stage)===column.id);
        return <Card key={column.id} className="min-w-[285px] shrink-0 p-3 xl:min-w-0">
          <div className="mb-2 rounded-xl bg-[color:var(--color-surface-muted)] p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{column.label}</p>
              <StatusBadge tone={column.id==='completed'?'success':'neutral'}>{columnItems.length}</StatusBadge>
            </div>
            <p className="mt-1 text-xs text-[color:var(--color-text-soft)]">{column.help}</p>
          </div>
          <div className="space-y-2">
            {columnItems.map(lead=><div key={lead.id} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-bold">{lead.requester_name||lead.name}</p>
                {column.id==='negotiation'||column.id==='locked'?<StatusBadge tone="warning">Hot Lead</StatusBadge>:null}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--color-text-soft)]">{text(lead.metadata?.listing_title)||lead.sector||'Listing yang dilihat'}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-700">{money(lead.value_cents||0,lead.currency||'IDR')}</span>
                <span className="text-[color:var(--color-text-soft)]">{date(lead.updated_at)}</span>
              </div>
              <label className="mt-3 block text-[11px] font-bold text-[color:var(--color-text-soft)]">
                Stage
                <select
                  value={lead.stage || 'new'}
                  disabled={!accessToken || busyId === lead.id}
                  onChange={event=>void changeStage(lead,event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-xs font-bold text-slate-900"
                >
                  {Array.from(new Set([lead.stage || 'new', ...STAGE_OPTIONS])).map(option=><option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>)}
            {!columnItems.length?<EmptyState title="Kosong" description="Belum ada lead di tahap ini." />:null}
          </div>
        </Card>
      })}
    </div>
  </div>;
}
