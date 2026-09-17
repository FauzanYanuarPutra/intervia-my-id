'use client';

import { startTransition, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Save, X } from 'lucide-react';
import { ModalSurface } from '@/components/interaction/ModalSurface';
import { BusinessImageCropUpload } from '@/components/media/BusinessImageCropUpload';
import { ProductModifierEditor } from '@/components/forms/ProductModifierEditor';
import type { ProductRecord } from '@/lib/portal-types';

type Props = {
  businessId: string;
  product: ProductRecord;
};

function rupiahNumber(priceLabel: string) {
  return priceLabel.replace(/\D/g, '');
}

export function ProductManageForm({ businessId, product }: Props) {
  const router = useRouter();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [priceRupiah, setPriceRupiah] = useState(rupiahNumber(product.priceLabel));
  const [status, setStatus] = useState<'live' | 'draft'>(product.status);
  const [stockCount, setStockCount] = useState(product.stockCount?.toString() ?? '');
  const [minStockAlert, setMinStockAlert] = useState(product.minStockAlert?.toString() ?? '');
  const [stockUnit, setStockUnit] = useState(product.stockUnit || 'pcs');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);

  async function request(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(result.error || 'Perubahan belum berhasil disimpan.');
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPrice = Number(priceRupiah);
    if (name.trim().length < 2 || !Number.isSafeInteger(normalizedPrice) || normalizedPrice <= 0) {
      setError('Periksa nama dan harga produk.');
      return;
    }

    setPending(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}`, {
        name: name.trim(),
        category: category.trim(),
        priceLabel: `Rp${new Intl.NumberFormat('id-ID').format(normalizedPrice)}`,
        status,
        minStockAlert: minStockAlert.trim() ? Number(minStockAlert) : null,
        stockUnit: stockUnit.trim(),
      });
      setSuccess('Detail produk tersimpan.');
      startTransition(() => router.refresh());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Perubahan belum berhasil disimpan.');
    } finally {
      setPending(false);
    }
  }

  async function saveStock() {
    const normalizedStock = stockCount.trim() ? Number(stockCount) : null;
    if (normalizedStock !== null && (!Number.isFinite(normalizedStock) || normalizedStock < 0)) {
      setError('Jumlah stok harus nol atau lebih.');
      return;
    }

    setPending(true);
    setError('');
    setSuccess('');
    try {
      await request(`/api/businesses/${businessId}/products/${product.id}/inventory`, {
        stockCount: normalizedStock,
        reason: 'manual_adjustment',
      });
      setSuccess('Stok diperbarui.');
      startTransition(() => router.refresh());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Stok belum berhasil diperbarui.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="portal-button-secondary mt-3"
      >
        <Pencil className="h-3.5 w-3.5" /> Kelola produk
      </button>

      <ModalSurface
        open={open}
        onOpenChange={setOpen}
        ariaLabel={`Kelola ${product.name}`}
        presentation="adaptive"
        size="lg"
        dismissible={!pending}
        returnFocusRef={openButtonRef}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-portal-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-portal-ink">Kelola produk</p>
            <p className="mt-0.5 text-xs leading-5 text-portal-soft">Detail, stok, foto, dan pilihan pembeli dalam satu tempat.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-portal-soft transition hover:bg-[#f4f5f2] hover:text-portal-ink disabled:opacity-50"
            aria-label="Tutup kelola produk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="mb-4 border-b border-portal-line pb-4">
            <BusinessImageCropUpload
              businessId={businessId}
              productId={product.id}
              kind="product"
              currentUrl={product.imageUrl}
              label="Foto produk / menu"
              description="Ganti foto lalu crop 1:1. Perubahan langsung tersimpan ke katalog publik."
            />
          </div>

          <form onSubmit={saveProduct} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Nama
              <input className="portal-input" value={name} onChange={event => setName(event.target.value)} maxLength={160} required />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Kategori
              <input className="portal-input" value={category} onChange={event => setCategory(event.target.value)} maxLength={120} required />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Harga (Rp)
              <input className="portal-input" type="number" min="1" step="1" value={priceRupiah} onChange={event => setPriceRupiah(event.target.value)} required />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Status
              <select className="portal-input" value={status} onChange={event => setStatus(event.target.value as 'live' | 'draft')}>
                <option value="live">Aktif</option>
                <option value="draft">Arsipkan</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Batas stok tipis
              <input className="portal-input" type="number" min="0" step="any" value={minStockAlert} onChange={event => setMinStockAlert(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-portal-ink">Satuan
              <input className="portal-input" value={stockUnit} onChange={event => setStockUnit(event.target.value)} maxLength={40} required />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={pending} className="portal-button-primary">
                <Save className="h-4 w-4" /> {pending ? 'Menyimpan...' : 'Simpan detail'}
              </button>
            </div>
          </form>

          <div className="mt-4 border-t border-portal-line pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1.5 text-xs font-semibold text-portal-ink">Stok saat ini
                <input className="portal-input" type="number" min="0" step="any" value={stockCount} onChange={event => setStockCount(event.target.value)} placeholder="Kosong = belum diketahui" />
              </label>
              <button type="button" onClick={saveStock} disabled={pending} className="portal-button-secondary sm:mb-0.5">
                <Save className="h-4 w-4" /> Update stok
              </button>
            </div>
          </div>

          <ProductModifierEditor businessId={businessId} productId={product.id} />

          {error ? <p className="mt-3 text-sm font-semibold text-portal-ember">{error}</p> : null}
          {success ? <p className="mt-3 text-sm font-semibold text-portal-forest">{success}</p> : null}
        </div>
      </ModalSurface>
    </>
  );
}
