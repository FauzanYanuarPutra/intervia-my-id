'use client';

import { useEffect, useState } from 'react';
import { Card, EmptyState, PageHeader, StatusBadge } from 'lajukan-ui';
import { useAuth } from '@/context/AuthContext';
import { superAppApi, type SuperAppOrderDetail } from '@/lib/api';
import type { CrmTransactionRow } from './models';
import { rankRiskTransactions } from './queues';

const money=(c:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Math.max(0,c)/100);

function readOrderIdFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('order') || '';
}

function writeOrderUrl(id: string, mode: 'push' | 'replace' = 'push'): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('page', 'transactions');
  if (id) url.searchParams.set('order', id);
  else url.searchParams.delete('order');
  const next = url.pathname + url.search + url.hash;
  if (mode === 'replace') window.history.replaceState({ crmOrder: id }, '', next);
  else window.history.pushState({ crmOrder: id }, '', next);
}

export function TransactionWorkspace({transactions}:{transactions:CrmTransactionRow[]}) {
  const { accessToken } = useAuth();
  const items=rankRiskTransactions(transactions);
  const [selectedId,setSelectedId]=useState(() => readOrderIdFromUrl());
  const [detail,setDetail]=useState<SuperAppOrderDetail|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function openOrder(id:string) {
    if (!accessToken) return;
    setSelectedId(id);
    writeOrderUrl(id);
    setBusy(true);
    setError('');
    try {
      setDetail(await superAppApi.getOrder(accessToken,id));
    } catch (value) {
      setDetail(null);
      setError(value instanceof Error ? value.message : 'Detail order gagal dimuat.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const handlePopState = () => setSelectedId(readOrderIdFromUrl());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (!items.some(item => item.id === selectedId)) {
      setSelectedId('');
      setDetail(null);
      writeOrderUrl('', 'replace');
      return;
    }
    if (!detail && !busy && accessToken) {
      void openOrder(selectedId);
    }
  }, [accessToken, busy, detail, items, selectedId]);

  return <div className="space-y-4">
    <PageHeader title="Order & risiko" description="Pantau status, nominal, dan event transaksi."/>
    {error?<div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div>:null}
    <div className="grid gap-2 xl:grid-cols-2">
      {items.map(tx=><Card key={tx.id} className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-bold">{tx.id}</p><p className="mt-1 text-xs text-[color:var(--color-text-soft)]">{tx.buyer} → {tx.seller} · {tx.serviceType}</p></div>
          <StatusBadge tone={tx.status==='disputed'||tx.riskScore>=70?'danger':tx.status==='completed'?'success':'warning'}>{tx.status}</StatusBadge>
        </div>
        <p className="mt-3 text-xl font-black">{money(tx.amountCents)}</p>
        <button type="button" onClick={()=>void openOrder(tx.id)} className="mt-3 rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs font-bold">Lihat detail & event</button>
        {selectedId===tx.id ? (
          <div className="mt-2 rounded-xl bg-[color:var(--color-surface-muted)] p-3">
            {busy ? (
              <div className="space-y-3" aria-busy="true">
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-[color:var(--color-border)] bg-white p-3">
                      <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                      <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-[color:var(--color-border)] bg-white p-3">
                      <div className="flex justify-between gap-2">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                      </div>
                      <div className="mt-2 h-12 animate-pulse rounded bg-slate-50" />
                    </div>
                  ))}
                </div>
              </div>
            ) : detail ? <>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-[color:var(--color-text-soft)]">Payment</dt><dd className="font-bold">{detail.order.payment_mode}</dd></div>
                <div><dt className="text-[color:var(--color-text-soft)]">Risk</dt><dd className="font-bold">{detail.order.risk_score}</dd></div>
                <div><dt className="text-[color:var(--color-text-soft)]">Dibuat</dt><dd className="font-bold">{new Date(detail.order.created_at).toLocaleString('id-ID')}</dd></div>
                <div><dt className="text-[color:var(--color-text-soft)]">Diperbarui</dt><dd className="font-bold">{new Date(detail.order.updated_at).toLocaleString('id-ID')}</dd></div>
              </dl>
              <div className="mt-3 space-y-2">
                {(detail.events || []).map(event=><div key={event.id} className="rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-xs">
                  <div className="flex justify-between gap-2"><span className="font-bold">{event.event_type}</span><span className="text-[color:var(--color-text-soft)]">{new Date(event.created_at).toLocaleString('id-ID')}</span></div>
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[10px] text-[color:var(--color-text-soft)]">{JSON.stringify(event.payload,null,2)}</pre>
                </div>)}
                {!detail.events?.length?<p className="text-xs text-[color:var(--color-text-soft)]">Belum ada event order.</p>:null}
              </div>
            </> : <p className="text-sm font-semibold">Detail order tidak tersedia.</p>}
          </div>
        ) : null}
      </Card>)}
      {!items.length?<EmptyState title="Belum ada transaksi" description="Transaksi real akan muncul saat order tersedia."/>:null}
    </div>
  </div>;
}
