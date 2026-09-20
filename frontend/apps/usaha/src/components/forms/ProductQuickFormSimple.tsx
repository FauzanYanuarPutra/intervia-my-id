'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ProductDetailsModal } from './ProductDetailsModal';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import { BusinessImageCropUpload } from '@/components/media/BusinessImageCropUpload';
import { businessApiErrorMessage } from '@/lib/business-api-error';
import type { BusinessImageValue } from '@/lib/media-crop';

type ProductQuickFormProps = { businessId: string };

const categoryOptions = ['Makanan', 'Minuman', 'Paket', 'Layanan', 'Lainnya'] as const;
const sourceTypeOptions = [
  { value: 'owned', label: 'Milik usaha sendiri' },
  { value: 'consignment', label: 'Barang titipan' },
] as const;
const stockModeOptions = [
  { value: 'manual', label: 'Sudah dihitung' },
  { value: 'estimated', label: 'Masih perkiraan' },
] as const;

export function ProductQuickForm({ businessId }: ProductQuickFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof categoryOptions)[number]>(categoryOptions[0]);
  const [sourceType, setSourceType] = useState<'owned' | 'consignment'>('owned');
  const [priceRupiah, setPriceRupiah] = useState('');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [stockCount, setStockCount] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('');
  const [stockUnit, setStockUnit] = useState('pcs');
  const [stockMode, setStockMode] = useState<'manual' | 'estimated'>('manual');
  const [consignmentTerms, setConsignmentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<BusinessImageValue>();
  const [imageInputKey, setImageInputKey] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Isi nama produk minimal 2 huruf.');
      return;
    }
    const normalizedPrice = Number(priceRupiah);
    if (!Number.isSafeInteger(normalizedPrice) || normalizedPrice <= 0) {
      setError('Isi harga jual dengan angka lebih dari 0.');
      return;
    }
    const normalizedStock = stockCount.trim() ? Number(stockCount) : null;
    if (normalizedStock !== null && (!Number.isFinite(normalizedStock) || normalizedStock < 0)) {
      setError('Stok tidak boleh kurang dari 0.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          priceLabel: `Rp${new Intl.NumberFormat('id-ID').format(normalizedPrice)}`,
          sourceType,
          ownerLabel: ownerLabel.trim(),
          stockCount: normalizedStock,
          minStockAlert: minStockAlert.trim() ? Number(minStockAlert) : null,
          stockUnit: stockUnit.trim() || 'pcs',
          stockMode,
          consignmentTerms: consignmentTerms.trim(),
          notes: notes.trim(),
          ...(image ? { image } : {}),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(businessApiErrorMessage(result, 'Produk belum berhasil ditambahkan. Coba lagi.', response.status));
        return;
      }

      setName('');
      setCategory(categoryOptions[0]);
      setSourceType('owned');
      setPriceRupiah('');
      setOwnerLabel('');
      setStockCount('');
      setMinStockAlert('');
      setStockUnit('pcs');
      setStockMode('manual');
      setConsignmentTerms('');
      setNotes('');
      setImage(undefined);
      setImageInputKey(value => value + 1);
      setSuccess('Produk berhasil ditambahkan.');
      startTransition(() => router.refresh());
    } catch {
      setError('Koneksi lagi bermasalah. Coba lagi.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="rounded-2xl bg-[#f6f8f4] px-4 py-3">
        <p className="text-sm font-bold text-portal-ink">Tambah produk dengan cepat</p>
        <p className="mt-1 text-xs leading-5 text-portal-soft">
          Yang wajib cuma nama dan harga. Foto dan stok membantu saat jualan, tetapi bisa dilengkapi nanti.
        </p>
      </div>

      <div className="rounded-2xl border border-portal-line bg-white p-3 sm:p-4">
        <BusinessImageCropUpload
          key={imageInputKey}
          businessId={businessId}
          kind="product"
          label="Foto produk"
          description="Opsional. Pilih foto yang mudah dikenali kasir dan pembeli, lalu atur potongannya."
          onUploaded={setImage}
        />
      </div>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Nama produk
        <input required minLength={2} maxLength={160} value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Jus Alpukat" autoComplete="off" className="portal-input h-12 text-base" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Harga jual
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-portal-soft">Rp</span>
            <input required type="number" inputMode="numeric" min="1" step="1" value={priceRupiah} onChange={event => setPriceRupiah(event.target.value)} placeholder="15000" className="portal-input h-12 w-full pl-10 text-base font-bold tabular-nums" />
          </div>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          <span>Stok saat ini <span className="font-normal text-portal-soft">(opsional)</span></span>
          <input type="number" inputMode="decimal" min="0" step="any" value={stockCount} onChange={event => setStockCount(event.target.value)} placeholder="Contoh: 12" className="portal-input h-12 text-base tabular-nums" />
        </label>
      </div>

      <ProductDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        category={category}
        onCategoryChange={setCategory}
        sourceType={sourceType}
        onSourceTypeChange={setSourceType}
        minStockAlert={minStockAlert}
        onMinStockAlertChange={setMinStockAlert}
        stockUnit={stockUnit}
        onStockUnitChange={setStockUnit}
        stockMode={stockMode}
        onStockModeChange={setStockMode}
        ownerLabel={ownerLabel}
        onOwnerLabelChange={setOwnerLabel}
        consignmentTerms={consignmentTerms}
        onConsignmentTermsChange={setConsignmentTerms}
        notes={notes}
        onNotesChange={setNotes}
      />

      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-portal-line bg-white px-4 py-3.5 text-left transition hover:border-portal-forest/40"
      >
        <span>
          <span className="block text-sm font-bold text-portal-ink">Detail lainnya</span>
          <span className="mt-0.5 block text-xs font-normal text-portal-soft">Kategori, stok, titipan, dan catatan</span>
        </span>
        <span className="shrink-0 rounded-full bg-portal-mist px-3 py-1 text-xs font-bold text-portal-forest">Atur</span>
      </button>

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-portal-ember">{error}</p> : null}
      {success ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending} className="portal-button-primary min-h-12 w-full justify-center text-base sm:w-auto">
        <Plus className="h-4 w-4" /> {isPending ? 'Menyimpan...' : 'Simpan produk'}
      </button>
    </form>
  );
}
