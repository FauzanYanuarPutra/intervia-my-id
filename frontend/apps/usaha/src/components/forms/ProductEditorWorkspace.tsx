'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CheckCircle2, Save } from 'lucide-react';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import { SensitiveActionConfirm } from '@/components/interaction/SensitiveActionConfirm';
import { BusinessImageCropUpload } from '@/components/media/BusinessImageCropUpload';
import { ProductModifierEditor } from '@/components/forms/ProductModifierEditor';
import type { ProductRecord } from '@/lib/portal-types';
import { businessApiErrorMessage } from '@/lib/business-api-error';

type Props = {
  businessId: string;
  product: ProductRecord;
};

type PendingAction = 'detail' | 'stock' | 'status' | null;

function rupiahNumber(priceLabel: string) {
  return priceLabel.replace(/\D/g, '');
}

export function ProductEditorWorkspace({ businessId, product }: Props) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [priceRupiah, setPriceRupiah] = useState(rupiahNumber(product.priceLabel));
  const [status, setStatus] = useState<'live' | 'draft'>(product.status);
  const [stockCount, setStockCount] = useState(product.stockCount?.toString() ?? '');
  const [minStockAlert, setMinStockAlert] = useState(product.minStockAlert?.toString() ?? '');
  const [stockUnit, setStockUnit] = useState(product.stockUnit || 'pcs');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [changeReason, setChangeReason] = useState('Pembaruan data produk');
  const [stockReason, setStockReason] = useState('Penyesuaian stok');
  const busy = pendingAction !== null;

  async function request(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(businessApiErrorMessage(result, 'Perubahan belum berhasil disimpan.', response.status));
  }

  function begin(action: Exclude<PendingAction, null>) {
    setPendingAction(action);
    setError('');
    setSuccess('');
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPrice = Number(priceRupiah);
    const normalizedThreshold = minStockAlert.trim() ? Number(minStockAlert) : null;

    if (name.trim().length < 2 || !Number.isSafeInteger(normalizedPrice) || normalizedPrice <= 0) {
      setError('Periksa nama dan harga produk.');
      return;
    }
    if (normalizedThreshold !== null && (!Number.isFinite(normalizedThreshold) || normalizedThreshold < 0)) {
      setError('Batas stok tipis harus nol atau lebih.');
      return;
    }
    if (!stockUnit.trim()) {
      setError('Satuan stok harus diisi.');
      return;
    }
    if (changeReason.trim().length < 3) {
      setError('Tulis alasan perubahan detail produk minimal 3 karakter.');
      return;
    }

    begin('detail');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}`, {
        name: name.trim(),
        category: category.trim(),
        priceLabel: `Rp${new Intl.NumberFormat('id-ID').format(normalizedPrice)}`,
        minStockAlert: normalizedThreshold,
        stockUnit: stockUnit.trim(),
        reason: changeReason.trim(),
      });
      setChangeReason('Pembaruan data produk');
      setSuccess('Detail produk tersimpan.');
      refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Perubahan belum berhasil disimpan.');
    } finally {
      setPendingAction(null);
    }
  }

  async function saveStock() {
    const normalizedStock = stockCount.trim() ? Number(stockCount) : null;
    if (normalizedStock !== null && (!Number.isFinite(normalizedStock) || normalizedStock < 0)) {
      setError('Jumlah stok harus nol atau lebih.');
      return;
    }
    if (stockReason.trim().length < 3) {
      setError('Tulis alasan perubahan stok minimal 3 karakter.');
      return;
    }

    begin('stock');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}/inventory`, {
        stockCount: normalizedStock,
        reason: stockReason.trim(),
      });
      setStockReason('Penyesuaian stok');
      setSuccess('Stok diperbarui.');
      refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Stok belum berhasil diperbarui.');
    } finally {
      setPendingAction(null);
    }
  }

  async function saveStatus() {
    begin('status');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}`, {
        status,
        reason: statusReason.trim(),
      });
      setSuccess(status === 'live' ? 'Produk kembali aktif.' : 'Produk diarsipkan.');
      refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Status produk belum berhasil diperbarui.');
    } finally {
      setPendingAction(null);
      setArchiveConfirmOpen(false);
    }
  }

  function requestStatusSave() {
    if (status === 'draft' && product.status === 'live') {
      setStatusReason('');
      setArchiveConfirmOpen(true);
      return;
    }
    void saveStatus();
  }

  return (
    <section className="merchant-surface-bordered overflow-hidden">
      <div className="border-b border-portal-line px-4 py-4 sm:px-5">
        <p className="text-base font-black text-portal-ink">Kelola produk</p>
        <p className="mt-0.5 text-xs leading-5 text-portal-soft">
          Ubah detail, stok, foto, dan pilihan pembeli tanpa menutup daftar produk.
        </p>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <BusinessImageCropUpload
          businessId={businessId}
          productId={product.id}
          kind="product"
          currentUrl={product.imageUrl}
          label="Foto produk / menu"
          description="Ganti foto lalu crop 1:1. Perubahan langsung tersimpan ke katalog publik."
        />

        <form onSubmit={saveProduct} className="grid gap-3 border-t border-portal-line pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
              Nama produk
              <input className="portal-input h-12" value={name} onChange={event => setName(event.target.value)} maxLength={160} required />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
              Harga jual
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-portal-soft">Rp</span>
                <input inputMode="numeric" className="portal-input h-12 w-full pl-10 text-base font-bold tabular-nums" type="number" min="1" step="1" value={priceRupiah} onChange={event => setPriceRupiah(event.target.value)} required />
              </div>
            </label>
          </div>

          <details className="group rounded-[16px] border border-portal-line bg-[#fafbf9]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-portal-ink">
              <span>Detail lainnya <span className="ml-2 text-xs font-normal text-portal-soft">Kategori, stok minimum, satuan</span></span>
              <span className="text-xs font-bold text-portal-forest group-open:hidden">Buka</span>
              <span className="hidden text-xs font-bold text-portal-forest group-open:inline">Tutup</span>
            </summary>
            <div className="grid gap-3 border-t border-portal-line p-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
                Kategori
                <input className="portal-input" value={category} onChange={event => setCategory(event.target.value)} maxLength={120} required />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
                Satuan stok
                <input className="portal-input" value={stockUnit} onChange={event => setStockUnit(event.target.value)} maxLength={40} required />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
                Batas stok tipis
                <input inputMode="decimal" className="portal-input" type="number" min="0" step="any" value={minStockAlert} onChange={event => setMinStockAlert(event.target.value)} placeholder="Kosongkan bila belum perlu" />
              </label>
            </div>
          </details>

          <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
            Catatan perubahan
            <input
              value={changeReason}
              onChange={event => setChangeReason(event.target.value)}
              maxLength={500}
              placeholder="Contoh: harga jual diperbarui"
              className="portal-input"
              aria-describedby="product-change-reason-hint"
            />
            <span id="product-change-reason-hint" className="text-[11px] font-normal leading-5 text-portal-soft">
              Sudah diisi otomatis. Ganti bila ada konteks khusus.
            </span>
          </label>

          <button type="submit" disabled={busy || changeReason.trim().length < 3} className="portal-button-primary w-full sm:w-fit">
            <Save className="h-4 w-4" /> {pendingAction === "detail" ? "Menyimpan..." : "Simpan perubahan"}
          </button>
        </form>
        <section className="border-t border-portal-line pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-portal-ink">
              Stok saat ini
              <input className="portal-input" type="number" min="0" step="any" value={stockCount} onChange={event => setStockCount(event.target.value)} placeholder="Kosong = belum diketahui" />
            </label>
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-portal-ink">
              Catatan stok
              <input
                value={stockReason}
                onChange={event => setStockReason(event.target.value)}
                maxLength={500}
                placeholder="Contoh: stok opname"
                className="portal-input"
              />
            </label>
            <button type="button" onClick={saveStock} disabled={busy || stockReason.trim().length < 3} className="portal-button-secondary sm:mb-0.5">
              <Save className="h-4 w-4" /> {pendingAction === 'stock' ? 'Menyimpan...' : 'Update stok'}
            </button>
          </div>
        </section>

        <ProductModifierEditor businessId={businessId} productId={product.id} />

        <section className="border-t border-portal-line pt-5">
          <div className="rounded-2xl bg-[#fafbf9] p-4">
            <div className="flex items-start gap-3">
              <span className="portal-icon-tile">
                {status === 'live' ? <CheckCircle2 className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-portal-ink">Status produk</p>
                <p className="mt-0.5 text-xs leading-5 text-portal-soft">
                  Arsip menyembunyikan produk dari penjualan tanpa menghapus riwayatnya.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <ChoiceChips
                value={status}
                onChange={setStatus}
                ariaLabel="Status produk"
                disabled={busy}
                options={[
                  { value: 'live', label: 'Aktif' },
                  { value: 'draft', label: 'Diarsipkan' },
                ]}
              />
            </div>
            <button type="button" onClick={requestStatusSave} disabled={busy} className="portal-button-secondary mt-3">
              {pendingAction === 'status' ? 'Menyimpan status...' : 'Simpan status'}
            </button>
          </div>
        </section>

        {error ? <p role="alert" aria-live="assertive" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-portal-ember">{error}</p> : null}
        {success ? <p role="status" aria-live="polite" className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-portal-forest">{success}</p> : null}
      </div>

      <SensitiveActionConfirm
        open={archiveConfirmOpen}
        title={status === 'draft' ? 'Arsipkan produk?' : 'Aktifkan kembali produk?'}
        description={
          status === 'draft'
            ? `${product.name} akan disembunyikan dari penjualan baru. Riwayat transaksi dan data produk tetap tersimpan.`
            : `${product.name} akan kembali tersedia untuk penjualan baru. Pastikan harga, stok, dan data produk sudah benar.`
        }
        confirmLabel={status === 'draft' ? 'Arsipkan produk' : 'Aktifkan kembali'}
        busy={pendingAction === 'status'}
        requireText
        value={statusReason}
        onValueChange={setStatusReason}
        onCancel={() => {
          if (!busy) setArchiveConfirmOpen(false);
        }}
        onConfirm={() => void saveStatus()}
      />
    </section>
  );
}
