'use client';

import { useMemo, useState } from 'react';
import { RotateCcw, Search, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { businessApiErrorMessage } from '@/lib/business-api-error';
import type { ControlSaleAggregate } from '@/lib/business-control-server';

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

type Props = {
  businessId: string;
  sales: ControlSaleAggregate[];
  canVoidSales: boolean;
  canViewCosting: boolean;
};

type Filter = 'semua' | 'selesai' | 'dibatalkan';

function labelStatus(status: ControlSaleAggregate['sale']['status']) {
  return status === 'voided' ? 'Dibatalkan' : 'Selesai';
}

export function SalesHistoryWorkspace({
  businessId,
  sales,
  canVoidSales,
  canViewCosting,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('semua');
  const [query, setQuery] = useState('');
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('id-ID');
    return sales.filter(({ sale, lines }) => {
      if (filter === 'selesai' && sale.status !== 'completed') return false;
      if (filter === 'dibatalkan' && sale.status !== 'voided') return false;
      if (!normalized) return true;
      const summary = lines
        .map(line => line.product_name)
        .join(' ')
        .toLocaleLowerCase('id-ID');
      return [
        sale.document_number,
        sale.occurred_on,
        sale.channel_key ?? '',
        sale.account_key,
        summary,
      ].some(value => value.toLocaleLowerCase('id-ID').includes(normalized));
    });
  }, [filter, query, sales]);

  async function voidSale(saleId: string) {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) {
      setMessage('Tulis alasan minimal 3 karakter agar koreksi bisa ditelusuri.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/sales/${encodeURIComponent(saleId)}/void`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({ reason: normalizedReason }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          businessApiErrorMessage(
            payload,
            'Koreksi transaksi belum berhasil. Coba lagi.',
            response.status,
          ),
        );
      }
      setVoidingId(null);
      setReason('');
      setMessage('Transaksi dibatalkan dan jejak koreksinya tersimpan.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Koreksi transaksi belum berhasil. Coba lagi.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="merchant-surface-bordered p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
            <input
              className="portal-input h-11 w-full pl-10"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Cari nomor, produk, atau kanal…"
              aria-label="Cari transaksi"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              ['semua', 'Semua'],
              ['selesai', 'Selesai'],
              ['dibatalkan', 'Dibatalkan'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${filter === key ? 'border-portal-ink bg-portal-ink text-white' : 'border-portal-line bg-white text-portal-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message ? (
        <p role="status" className="rounded-xl bg-[#f5f7f3] px-4 py-3 text-xs font-semibold text-portal-soft">
          {message}
        </p>
      ) : null}

      <div className="merchant-list border border-portal-line/80">
        {filtered.length ? filtered.map(({ sale, lines }) => {
          const itemSummary = lines
            .map(line => `${line.product_name} × ${Number(line.quantity).toLocaleString('id-ID')}`)
            .join(', ');
          const grossProfit =
            sale.status === 'completed' &&
            sale.cost_complete &&
            sale.cogs_amount !== null
              ? sale.final_amount - sale.cogs_amount
              : null;
          const isVoiding = voidingId === sale.id;

          return (
            <article key={sale.id} className="space-y-3 border-b border-portal-line/80 p-4 last:border-b-0">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-portal-ink">{sale.document_number}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${sale.status === 'voided' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {labelStatus(sale.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-portal-ink">{itemSummary || 'Tanpa item'}</p>
                  <p className="mt-1 text-[11px] text-portal-soft">
                    {sale.occurred_on} · {sale.channel_key || 'Langsung'} · {sale.account_key}
                  </p>
                  {sale.status === 'voided' && sale.void_reason ? (
                    <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                      Alasan: {sale.void_reason}
                      {sale.voided_at ? ` · ${new Date(sale.voided_at).toLocaleString('id-ID')}` : ''}
                    </p>
                  ) : null}
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] font-semibold text-portal-soft">Total</p>
                  <p className="text-sm font-black text-portal-ink">{money.format(sale.final_amount)}</p>
                  <p className="mt-1 text-[10px] text-portal-soft">
                    {canViewCosting
                      ? grossProfit === null
                        ? 'HPP belum lengkap'
                        : `Laba kotor ${money.format(grossProfit)}`
                      : 'Detail biaya sesuai akses'}
                  </p>
                </div>
                {canVoidSales && sale.status === 'completed' ? (
                  <button
                    type="button"
                    className="portal-button-secondary justify-center border-red-200 text-red-700"
                    onClick={() => {
                      setVoidingId(isVoiding ? null : sale.id);
                      setReason('');
                      setMessage('');
                    }}
                    disabled={busy}
                  >
                    <XCircle className="h-4 w-4" />
                    {isVoiding ? 'Tutup' : 'Batalkan'}
                  </button>
                ) : null}
              </div>

              {isVoiding ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex gap-3">
                    <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-red-950">Koreksi transaksi</p>
                      <p className="mt-1 text-xs leading-5 text-red-800">
                        Transaksi asli tetap disimpan. Lajukan akan membalik stok dan catatan pendapatan secara terukur, lalu menyimpan alasan koreksi.
                      </p>
                      <label className="mt-3 block text-xs font-bold text-red-900">
                        Alasan pembatalan
                        <textarea
                          value={reason}
                          onChange={event => setReason(event.target.value)}
                          maxLength={500}
                          autoFocus
                          className="mt-1 min-h-24 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-portal-ink outline-none"
                          placeholder="Contoh: salah input jumlah, seharusnya 2"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="portal-button-secondary justify-center"
                          onClick={() => {
                            setVoidingId(null);
                            setReason('');
                          }}
                          disabled={busy}
                        >
                          Jangan batalkan
                        </button>
                        <button
                          type="button"
                          className="portal-button-primary justify-center"
                          onClick={() => void voidSale(sale.id)}
                          disabled={busy || reason.trim().length < 3}
                        >
                          {busy ? 'Membatalkan…' : 'Simpan pembatalan'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        }) : (
          <div className="p-8 text-center">
            <p className="text-sm font-bold text-portal-ink">Transaksi tidak ditemukan</p>
            <p className="mt-1 text-xs text-portal-soft">Coba pencarian atau filter lain.</p>
          </div>
        )}
      </div>
    </section>
  );
}
