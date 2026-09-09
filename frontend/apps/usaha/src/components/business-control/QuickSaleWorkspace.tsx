'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import {
  buildQuickSaleRequest,
  priceLabelToAmount,
  quickSaleTotal,
  type QuickSaleLineDraft,
} from './quick-sale';

type ProductOption = { id: string; name: string; priceLabel: string };
type DraftLine = QuickSaleLineDraft & { key: string };

type Props = {
  businessId: string;
  products: ProductOption[];
  defaultDate: string;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function newLine(product?: ProductOption): DraftLine {
  return {
    key: crypto.randomUUID(),
    productId: product?.id ?? '',
    quantity: 1,
    unitPriceAmount: product ? priceLabelToAmount(product.priceLabel) : 0,
    discountAmount: 0,
  };
}

export function QuickSaleWorkspace({ businessId, products, defaultDate }: Props) {
  const router = useRouter();
  const [occurredOn, setOccurredOn] = useState(defaultDate);
  const [channelKey, setChannelKey] = useState('offline');
  const [accountKey, setAccountKey] = useState<
    'cash' | 'bank' | 'ewallet' | 'receivable'
  >('cash');
  const [lines, setLines] = useState<DraftLine[]>(() =>
    products[0] ? [newLine(products[0])] : [],
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const attemptKey = useRef<string | null>(null);

  const total = useMemo(() => quickSaleTotal(lines), [lines]);

  function changed() {
    attemptKey.current = null;
    setFeedback(null);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    changed();
    setLines(current =>
      current.map(line => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function selectProduct(line: DraftLine, productId: string) {
    const product = products.find(item => item.id === productId);
    updateLine(line.key, {
      productId,
      unitPriceAmount: product
        ? priceLabelToAmount(product.priceLabel)
        : line.unitPriceAmount,
    });
  }

  async function submit() {
    try {
      const payload = buildQuickSaleRequest({
        occurredOn,
        channelKey,
        accountKey,
        lines,
      });
      const idempotencyKey = attemptKey.current ?? crypto.randomUUID();
      attemptKey.current = idempotencyKey;
      setSaving(true);
      setFeedback(null);
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/sales`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || 'sale_save_failed');

      attemptKey.current = null;
      setFeedback({
        tone: 'success',
        text: 'Penjualan tersimpan dan HPP historis sudah dikunci.',
      });
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'sale_save_failed';
      const message =
        code === 'sale_costing_incomplete'
          ? 'HPP produk belum lengkap. Lengkapi resep dan bahan sebelum mencatat penjualan.'
          : code === 'sale_discount_exceeds_line_total'
            ? 'Diskon tidak boleh melebihi subtotal produk.'
            : 'Penjualan belum tersimpan. Periksa data lalu coba lagi.';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  if (!products.length) {
    return (
      <div className="rounded-xl border border-dashed border-portal-line p-4 text-sm text-portal-soft">
        Tambahkan produk dan HPP terlebih dahulu sebelum mencatat penjualan.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[minmax(180px,1.4fr)_80px_120px_120px_44px] gap-2 px-1 text-[11px] font-bold text-portal-soft md:grid">
        <span>Produk</span>
        <span>Qty</span>
        <span>Harga</span>
        <span>Diskon</span>
        <span />
      </div>
      <div className="space-y-2">
        {lines.map(line => (
          <div
            key={line.key}
            className="grid gap-2 rounded-xl border border-portal-line p-3 md:grid-cols-[minmax(180px,1.4fr)_80px_120px_120px_44px] md:items-center md:border-0 md:p-0"
          >
            <label className="grid gap-1 text-xs font-semibold text-portal-soft md:block">
              <span className="md:hidden">Produk</span>
              <select
                className="portal-input w-full"
                value={line.productId}
                onChange={event => selectProduct(line, event.target.value)}
              >
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-portal-soft md:block">
              <span className="md:hidden">Qty</span>
              <input
                className="portal-input w-full"
                type="number"
                min="0.001"
                step="0.001"
                value={line.quantity}
                onChange={event =>
                  updateLine(line.key, { quantity: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-portal-soft md:block">
              <span className="md:hidden">Harga</span>
              <input
                className="portal-input w-full"
                type="number"
                min="0"
                step="1"
                value={line.unitPriceAmount}
                onChange={event =>
                  updateLine(line.key, { unitPriceAmount: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-portal-soft md:block">
              <span className="md:hidden">Diskon</span>
              <input
                className="portal-input w-full"
                type="number"
                min="0"
                step="1"
                value={line.discountAmount}
                onChange={event =>
                  updateLine(line.key, { discountAmount: event.target.value })
                }
              />
            </label>
            <button
              type="button"
              aria-label="Hapus produk"
              className="portal-button-secondary h-10 w-full px-0 md:w-10"
              disabled={lines.length === 1}
              onClick={() => {
                changed();
                setLines(current =>
                  current.filter(item => item.key !== line.key),
                );
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="portal-button-secondary"
        onClick={() => {
          changed();
          setLines(current => [...current, newLine(products[0])]);
        }}
      >
        <Plus className="h-4 w-4" /> Produk
      </button>

      <div className="grid gap-3 rounded-xl bg-[#fafbf9] p-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <label className="grid gap-1 text-xs font-semibold text-portal-soft">
          Kanal
          <select
            className="portal-input"
            value={channelKey}
            onChange={event => {
              changed();
              setChannelKey(event.target.value);
            }}
          >
            <option value="offline">Offline</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="gofood">GoFood</option>
            <option value="grabfood">GrabFood</option>
            <option value="other">Lainnya</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-portal-soft">
          Masuk ke
          <select
            className="portal-input"
            value={accountKey}
            onChange={event => {
              changed();
              setAccountKey(event.target.value as typeof accountKey);
            }}
          >
            <option value="cash">Kas</option>
            <option value="bank">Bank</option>
            <option value="ewallet">E-wallet</option>
            <option value="receivable">Piutang</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-portal-soft">
          Tanggal
          <input
            className="portal-input"
            type="date"
            value={occurredOn}
            onChange={event => {
              changed();
              setOccurredOn(event.target.value);
            }}
          />
        </label>
        <div className="flex items-end justify-between gap-3 lg:block lg:text-right">
          <div>
            <p className="text-[11px] font-bold text-portal-soft">Total</p>
            <p className="text-lg font-bold text-portal-ink">
              {money.format(total)}
            </p>
          </div>
          <button
            type="button"
            className="portal-button-primary"
            disabled={saving || !lines.length}
            onClick={submit}
          >
            {saving ? 'Menyimpan…' : 'Simpan jualan'}
          </button>
        </div>
      </div>

      {feedback ? (
        <p
          role="status"
          className={`text-sm font-semibold ${feedback.tone === 'success' ? 'text-emerald-700' : 'text-red-700'}`}
        >
          {feedback.text}
        </p>
      ) : null}
      <p className="text-xs leading-5 text-portal-soft">
        HPP tidak diedit di form ini. Saat disimpan, backend mengambil resep aktif
        dan mengunci snapshot biaya historis.
      </p>
    </div>
  );
}
