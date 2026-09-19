'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { History, RefreshCw, X } from 'lucide-react';
import { ModalSurface } from '@/components/interaction/ModalSurface';

type AuditEvent = {
  id: string;
  actor_user_id: string | null;
  actor_is_current_user?: boolean;
  event_key: string;
  subject_type: string;
  subject_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

type Props = {
  businessId: string;
  compact?: boolean;
};

const labels: Record<string, string> = {
  'business.profile_updated': 'Profil usaha diubah',
  'business.operations_updated': 'Operasional usaha diubah',
  'business.locations_updated': 'Lokasi usaha diubah',
  'business_location.updated': 'Lokasi diubah',
  'product.created': 'Produk dibuat',
  'product.updated': 'Produk diubah',
  'product.archived': 'Produk diarsipkan',
  'inventory.adjusted': 'Stok disesuaikan',
  'ingredient.created': 'Bahan dibuat',
  'ingredient.updated': 'Bahan diubah',
  'ingredient.archived': 'Bahan diarsipkan',
  'business_sale.voided': 'Transaksi dikoreksi',
  'channel.updated': 'Kanal penjualan diubah',
  'product.modifiers_updated': 'Pilihan pelanggan diubah',
  'order.transitioned': 'Status pesanan berubah',
  'recipe.published': 'Resep diterbitkan',
  'recipe.retired': 'Resep dihentikan',
  'branch.created': 'Cabang dibuat',
  'finance.entry_corrected': 'Catatan keuangan dikoreksi',
  'finance.allocation_moved': 'Alokasi dana dipindahkan',
};

function eventLabel(eventKey: string) {
  return labels[eventKey] ?? eventKey.replaceAll('.', ' ').replaceAll('_', ' ');
}

function humanDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function readSummary(event: AuditEvent) {
  const summary = event.metadata?.summary;
  if (typeof summary === 'string' && summary.trim()) return summary.trim();
  const changedFields = event.metadata?.changed_fields;
  if (Array.isArray(changedFields) && changedFields.length) {
    const values = changedFields.filter(value => typeof value === 'string');
    if (values.length) return `Field berubah: ${values.join(', ')}`;
  }
  return null;
}

export function ChangeHistoryDrawer({ businessId, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const returnFocusRef = useRef<HTMLButtonElement>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/audit-events?limit=150`,
        { cache: 'no-store' },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        items?: AuditEvent[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Riwayat belum bisa dimuat.');
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Riwayat belum bisa dimuat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const grouped = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    return items
      .filter(item => item.event_key && item.occurred_at)
      .filter(item => {
        if (!needle) return true;
        const summary = readSummary(item) ?? '';
        const haystack = [
          eventLabel(item.event_key),
          item.event_key,
          summary,
          item.reason ?? '',
        ].join(' ').toLocaleLowerCase('id-ID');
        return haystack.includes(needle);
      });
  }, [items, query]);

  return (
    <>
      <button
        ref={returnFocusRef}
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'portal-button-ghost min-h-9 px-2.5 text-xs'
            : 'flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-portal-soft transition hover:bg-[#f4f6f4] hover:text-portal-ink'
        }
        aria-haspopup="dialog"
      >
        <History className="h-4 w-4" />
        <span>Riwayat perubahan</span>
      </button>

      <ModalSurface
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Riwayat perubahan usaha"
        presentation="sheet"
        size="md"
        returnFocusRef={returnFocusRef}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-portal-line px-4 pb-3 pt-4 sm:px-5">
            <div>
              <p className="text-base font-black text-portal-ink">Riwayat perubahan</p>
              <p className="mt-1 text-xs leading-5 text-portal-soft">
                Semua perubahan penting dicatat. Data lama tidak ditimpa begitu saja.
              </p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl text-portal-soft hover:bg-portal-mist hover:text-portal-ink"
                onClick={() => void load()}
                disabled={loading}
                aria-label="Muat ulang riwayat"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl text-portal-soft hover:bg-portal-mist hover:text-portal-ink"
                onClick={() => setOpen(false)}
                aria-label="Tutup riwayat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <label className="mb-3 block">
              <span className="sr-only">Cari riwayat perubahan</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Cari perubahan, alasan, atau nama tindakan…"
                className="portal-input min-h-11 w-full"
                autoComplete="off"
              />
            </label>

            {loading && !grouped.length ? (
              <div className="space-y-3" aria-live="polite">
                {[0, 1, 2, 3].map(item => (
                  <div key={item} className="animate-pulse rounded-2xl border border-portal-line p-4">
                    <div className="h-3 w-32 rounded bg-portal-mist" />
                    <div className="mt-3 h-3 w-4/5 rounded bg-portal-mist" />
                    <div className="mt-2 h-3 w-2/3 rounded bg-portal-mist" />
                  </div>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-portal-ember" role="alert">
                {error}
              </div>
            ) : null}

            {!loading && !error && !grouped.length ? (
              <div className="rounded-2xl border border-dashed border-portal-line p-6 text-center">
                <History className="mx-auto h-6 w-6 text-portal-soft" />
                <p className="mt-3 text-sm font-black text-portal-ink">Belum ada riwayat yang tercatat</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">
                  Perubahan penting berikutnya akan muncul di sini.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              {grouped.map(event => {
                const summary = readSummary(event);
                return (
                  <article key={event.id} className="rounded-2xl border border-portal-line/80 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-portal-mist px-2.5 py-1 text-[10px] font-black text-portal-ink">
                        {eventLabel(event.event_key)}
                      </span>
                      <span className="text-[10px] font-semibold text-portal-soft">
                        {humanDate(event.occurred_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-portal-soft">
{event.actor_is_current_user ? 'Dilakukan oleh Anda' : event.actor_user_id ? 'Dilakukan oleh anggota tim' : 'Dicatat oleh sistem'}
                    </p>
                    {summary ? (
                      <p className="mt-2 text-sm font-semibold leading-5 text-portal-ink">{summary}</p>
                    ) : null}
                    {event.reason ? (
                      <div className="mt-3 rounded-xl bg-[#fafbf9] px-3 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-wide text-portal-soft">Alasan</p>
                        <p className="mt-1 text-xs leading-5 text-portal-ink">{event.reason}</p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </ModalSurface>
    </>
  );
}
