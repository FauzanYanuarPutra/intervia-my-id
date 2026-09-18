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

    begin('detail');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}`, {
        name: name.trim(),
        category: category.trim(),
        priceLabel: `Rp${new Intl.NumberFormat('id-ID').format(normalizedPrice)}`,
        minStockAlert: normalizedThreshold,
        stockUnit: stockUnit.trim(),
      });
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

    begin('stock');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}/inventory`, {
        stockCount: normalizedStock,
        reason: 'manual_adjustment',
      });
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
      await request(`/api/businesses/${businessId}/products/${product.id}`, { status });
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

        <form onSubmit={saveProduct} className="grid gap-3 border-t border-portal-line pt-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">
            Nama
            <input className="portal-input" value={name} onChange={event => setName(event.target.value)} maxLength={160} required />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">
            Kategori
            <input className="portal-input" value={category} onChange={event => setCategory(event.target.value)} maxLength={120} required />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">
            Harga (Rp)
            <input className="portal-input" type="number" min="1" step="1" value={priceRupiah} onChange={event => setPriceRupiah(event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">
            Batas stok tipis
            <input className="portal-input" type="number" min="0" step="any" value={minStockAlert} onChange={event => setMinStockAlert(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-portal-ink sm:col-span-2">
            Satuan stok
            <input className="portal-input" value={stockUnit} onChange={event => setStockUnit(event.target.value)} maxLength={40} required />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="portal-button-primary">
              <Save className="h-4 w-4" /> {pendingAction === 'detail' ? 'Menyimpan...' : 'Simpan detail'}
            </button>
          </div>
        </form>

        <section className="border-t border-portal-line pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1.5 text-xs font-semibold text-portal-ink">
              Stok saat ini
              <input className="portal-input" type="number" min="0" step="any" value={stockCount} onChange={event => setStockCount(event.target.value)} placeholder="Kosong = belum diketahui" />
            </label>
            <button type="button" onClick={saveStock} disabled={busy} className="portal-button-secondary sm:mb-0.5">
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
        title="Arsipkan produk?"
        description={`${product.name} akan disembunyikan dari penjualan baru. Riwayat transaksi dan data produk tetap tersimpan, dan produk bisa diaktifkan kembali kapan saja.`}
        confirmLabel="Arsipkan produk"
        busy={pendingAction === 'status'}
        onCancel={() => {
          if (!busy) setArchiveConfirmOpen(false);
        }}
        onConfirm={() => void saveStatus()}
      />
    </section>
  );
}
