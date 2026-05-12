'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

type ProductQuickFormProps = {
  businessId: string;
};

const categoryOptions = [
  'Makanan',
  'Minuman',
  'Paket',
  'Layanan',
  'Lainnya',
];

const sourceTypeOptions = [
  { value: 'owned', label: 'Stok milik warung' },
  { value: 'consignment', label: 'Barang titipan' },
] as const;

export function ProductQuickForm({ businessId }: ProductQuickFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]);
  const [sourceType, setSourceType] =
    useState<(typeof sourceTypeOptions)[number]['value']>('owned');
  const [priceLabel, setPriceLabel] = useState('');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [stockLabel, setStockLabel] = useState('Siap');
  const [stockCount, setStockCount] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('');
  const [stockUnit, setStockUnit] = useState('pcs');
  const [stockMode, setStockMode] = useState<'manual' | 'estimated'>('manual');
  const [consignmentTerms, setConsignmentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim().length < 2) {
      setError('Nama produk belum valid.');
      return;
    }

    if (priceLabel.trim().length < 2) {
      setError('Harga produk belum valid.');
      return;
    }

    if (stockLabel.trim().length < 2) {
      setError('Status stok belum valid.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);

    try {
      const response = await fetch(`/api/businesses/${businessId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          category,
          priceLabel: priceLabel.trim(),
          stockLabel: stockLabel.trim(),
          sourceType,
          ownerLabel: ownerLabel.trim(),
          stockCount: stockCount.trim() ? Number(stockCount) : null,
          minStockAlert: minStockAlert.trim() ? Number(minStockAlert) : null,
          stockUnit: stockUnit.trim(),
          stockMode,
          consignmentTerms: consignmentTerms.trim(),
          notes: notes.trim(),
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'Produk belum berhasil ditambah.');
        return;
      }

      setName('');
      setPriceLabel('');
      setOwnerLabel('');
      setStockLabel('Siap');
      setStockCount('');
      setMinStockAlert('');
      setStockUnit('pcs');
      setStockMode('manual');
      setConsignmentTerms('');
      setNotes('');
      setSuccess('Produk masuk ke katalog.');
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError('Koneksi lagi bermasalah. Coba lagi.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Nama produk
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Contoh: Es Kopi Susu"
          className="portal-input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Kategori
          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="portal-input"
          >
            {categoryOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Sumber barang
          <select
            value={sourceType}
            onChange={event => setSourceType(event.target.value as 'owned' | 'consignment')}
            className="portal-input"
          >
            {sourceTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Harga
          <input
            value={priceLabel}
            onChange={event => setPriceLabel(event.target.value)}
            placeholder="Rp18.000"
            className="portal-input"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Stok
        <input
          value={stockLabel}
          onChange={event => setStockLabel(event.target.value)}
          placeholder="Siap / Sisa 12 / Pre-order"
          className="portal-input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Jumlah stok
          <input
            inputMode="numeric"
            value={stockCount}
            onChange={event => setStockCount(event.target.value)}
            placeholder="12"
            className="portal-input"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Batas stok tipis
          <input
            inputMode="numeric"
            value={minStockAlert}
            onChange={event => setMinStockAlert(event.target.value)}
            placeholder="5"
            className="portal-input"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Satuan stok
          <input
            value={stockUnit}
            onChange={event => setStockUnit(event.target.value)}
            placeholder="pcs / bungkus / botol"
            className="portal-input"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Mode stok
          <select
            value={stockMode}
            onChange={event => setStockMode(event.target.value as 'manual' | 'estimated')}
            className="portal-input"
          >
            <option value="manual">Manual, sudah dihitung</option>
            <option value="estimated">Estimasi, perlu cocokkan</option>
          </select>
        </label>
      </div>

      {sourceType === 'consignment' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-portal-ink">
            Nama penitip / supplier
            <input
              value={ownerLabel}
              onChange={event => setOwnerLabel(event.target.value)}
              placeholder="Contoh: Bu Rini Snack"
              className="portal-input"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-portal-ink">
            Skema titip jual
            <input
              value={consignmentTerms}
              onChange={event => setConsignmentTerms(event.target.value)}
              placeholder="Bagi hasil 80/20, setor mingguan"
              className="portal-input"
            />
          </label>
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Catatan operasional
        <input
          value={notes}
          onChange={event => setNotes(event.target.value)}
          placeholder="Contoh: titipan laris pagi, hitung ulang jam 17.00"
          className="portal-input"
        />
      </label>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending} className="portal-button-primary">
        <Plus className="h-4 w-4" />
        {isPending ? 'Menambahkan...' : 'Tambah produk'}
      </button>
    </form>
  );
}
