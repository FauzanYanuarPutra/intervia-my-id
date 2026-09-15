'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Save } from 'lucide-react';
import { BusinessImageCropUpload } from '@/components/media/BusinessImageCropUpload';
import { PortalDialog } from '@/components/portal/PortalDialog';
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
      <button type="button" onClick={() => setOpen(true)} className="portal-button-secondary mt-3">
        <Pencil className="h-3.5 w-3.5" /> Kelola produk
      </button>

      <PortalDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Kelola ${product.name}`}
        description="Detail, stok, foto, dan pilihan pembeli tersimpan ke katalog canonical Lajukan."
        busy={pending}
        size="lg"
      >
        <div className="space-y-5">
          <section>
            <BusinessImageCropUpload
              businessId={businessId}
              productId={product.id}
              kind="product"
              currentUrl={product.imageUrl}
              label="Foto produk / menu"
              description="Ganti foto lalu crop 1:1. Perubahan langsung tersimpan ke katalog publik."
            />
          </section>

          <section className="border-t border-portal-line pt-5">
            <div className="mb-3">
              <p className="text-sm font-black text-portal-ink">Detail produk</p>
              <p className="mt-0.5 text-xs text-portal-soft">Informasi utama yang dilihat pembeli.</p>
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
                  <Save className="h-4 w-4" /> {pending ? 'Menyimpan…' : 'Simpan detail'}
                </button>
              </div>
            </form>
          </section>

          <section className="border-t border-portal-line pt-5">
            <div className="mb-3">
              <p className="text-sm font-black text-portal-ink">Stok</p>
              <p className="mt-0.5 text-xs text-portal-soft">Semua racikan produk memakai stok produk yang sama.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1.5 text-xs font-semibold text-portal-ink">Stok saat ini
                <input className="portal-input" type="number" min="0" step="any" value={stockCount} onChange={event => setStockCount(event.target.value)} placeholder="Kosong = belum diketahui" />
              </label>
              <button type="button" onClick={saveStock} disabled={pending} className="portal-button-secondary sm:mb-0.5">
                <Save className="h-4 w-4" /> Update stok
              </button>
            </div>
          </section>

          <section className="border-t border-portal-line pt-5">
            <ProductModifierEditor businessId={businessId} productId={product.id} />
          </section>

          {error ? <p role="status" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p> : null}
          {success ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">{success}</p> : null}
        </div>
      </PortalDialog>
    </>
  );
}
