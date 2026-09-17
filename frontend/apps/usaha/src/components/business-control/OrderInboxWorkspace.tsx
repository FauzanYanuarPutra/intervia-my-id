'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock3, Search, ShoppingBag } from 'lucide-react';
import type { OrderRecord, OrderStatus } from '@/lib/portal-types';
import { nextOrderAction, orderStatusFilter, type OrderFilter } from '@/lib/business-control/order-workflow';
import { StatusBadge } from '@/components/portal/StatusBadge';

const filters: Array<{ key: OrderFilter; label: string }> = [
  { key: 'semua', label: 'Semua' },
  { key: 'baru', label: 'Baru' },
  { key: 'diproses', label: 'Diproses' },
  { key: 'siap kirim', label: 'Siap' },
  { key: 'selesai', label: 'Selesai' },
];

function orderTone(status: OrderStatus): 'info' | 'warning' | 'success' | 'neutral' {
  if (status === 'baru') return 'info';
  if (status === 'diproses' || status === 'siap kirim') return 'warning';
  if (status === 'selesai') return 'success';
  return 'neutral';
}

type Props = {
  orders: OrderRecord[];
  canManageOrders: boolean;
};

export function OrderInboxWorkspace({ orders, canManageOrders }: Props) {
  const [filter, setFilter] = useState<OrderFilter>('semua');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? '');

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter(order => {
      if (!orderStatusFilter(order.status, filter)) return false;
      if (!normalizedQuery) return true;
      return [order.id, order.buyer, order.itemSummary, order.channel]
        .some(value => value.toLowerCase().includes(normalizedQuery));
    });
  }, [filter, orders, query]);

  const selected = filteredOrders.find(order => order.id === selectedId) ?? filteredOrders[0] ?? null;
  const nextAction = selected ? nextOrderAction(selected.status) : null;

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-portal-line bg-white p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f5f1] text-portal-soft"><ShoppingBag className="h-5 w-5" /></div>
        <p className="mt-3 text-sm font-black text-portal-ink">Belum ada pesanan kanal</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-portal-soft">Pesanan dari kanal online akan masuk ke antrean ini tanpa bercampur dengan transaksi kasir langsung.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 space-y-3">
        <div className="portal-panel p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
            <input className="portal-input min-h-11 w-full pl-10" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari pembeli, nomor, atau isi pesanan…" aria-label="Cari pesanan" autoComplete="off" />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map(item => {
              const count = item.key === 'semua' ? orders.length : orders.filter(order => order.status === item.key).length;
              const active = filter === item.key;
              return (
                <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition ${active ? 'border-portal-ink bg-portal-ink text-white' : 'border-portal-line bg-white text-portal-ink hover:bg-[#fafbf9]'}`}>
                  {item.label} · {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-portal-line bg-white">
          {filteredOrders.length ? filteredOrders.map(order => {
            const active = selected?.id === order.id;
            return (
              <button key={order.id} type="button" onClick={() => setSelectedId(order.id)} className={`grid w-full gap-2 border-b border-portal-line px-4 py-3 text-left last:border-b-0 sm:grid-cols-[minmax(0,.8fr)_minmax(0,1.4fr)_110px_auto] sm:items-center ${active ? 'bg-[#f5f7f3]' : 'bg-white hover:bg-[#fafbf9]'}`}>
                <div className="min-w-0"><p className="truncate text-sm font-black text-portal-ink">{order.buyer}</p><p className="mt-0.5 truncate text-[11px] text-portal-soft">{order.channel} · {order.id}</p></div>
                <p className="min-w-0 truncate text-sm text-portal-ink">{order.itemSummary}</p>
                <strong className="text-sm text-portal-ink">{order.amountLabel}</strong>
                <div className="flex items-center justify-between gap-2 sm:justify-end"><StatusBadge tone={orderTone(order.status)}>{order.status}</StatusBadge><ChevronRight className="h-4 w-4 text-portal-soft" /></div>
              </button>
            );
          }) : <div className="p-8 text-center"><p className="text-sm font-bold text-portal-ink">Pesanan tidak ditemukan</p><p className="mt-1 text-xs text-portal-soft">Ubah pencarian atau pilih filter lain.</p></div>}
        </div>
      </section>

      <aside className="min-w-0 lg:sticky lg:top-3 lg:self-start">
        {selected ? (
          <div className="portal-panel overflow-hidden">
            <div className="border-b border-portal-line px-4 py-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-portal-soft">Detail pesanan</p><h2 className="mt-1 truncate text-lg font-black text-portal-ink">{selected.buyer}</h2><p className="mt-0.5 text-xs text-portal-soft">{selected.channel} · {selected.id}</p></div><StatusBadge tone={orderTone(selected.status)}>{selected.status}</StatusBadge></div>
            </div>
            <div className="space-y-4 p-4">
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-portal-soft">Isi pesanan</p><p className="mt-1 text-sm leading-6 text-portal-ink">{selected.itemSummary}</p></div>
              <div className="flex items-end justify-between gap-3 rounded-2xl bg-[#f5f7f3] p-4"><span className="text-sm font-semibold text-portal-soft">Total</span><strong className="text-xl text-portal-ink">{selected.amountLabel}</strong></div>

              {nextAction ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Langkah berikutnya</p><p className="mt-1 text-base font-black text-amber-950">{nextAction.label}</p><p className="mt-1 text-xs leading-5 text-amber-800">Urutan operasional: {selected.status} → {nextAction.nextStatus}. Status masih mengikuti sumber pesanan karena kontrak backend saat ini belum menyediakan aksi perubahan status dari halaman ini.</p></div></div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><div><p className="text-sm font-black text-emerald-950">Pesanan selesai</p><p className="mt-1 text-xs leading-5 text-emerald-800">Tidak ada langkah operasional berikutnya.</p></div></div></div>
              )}

              <p className="text-[11px] leading-5 text-portal-soft">Akses: {canManageOrders ? 'pengelola pesanan' : 'pantau saja'}. Lajukan tidak akan menampilkan aksi yang seolah berhasil jika backend belum memiliki mutation resminya.</p>
            </div>
          </div>
        ) : <div className="portal-panel p-5 text-sm text-portal-soft">Pilih pesanan untuk melihat detail.</div>}
      </aside>
    </div>
  );
}
