'use client';

import { X } from 'lucide-react';
import { ChoiceChips } from '@/components/interaction/ChoiceChips';

const categoryOptions = ['Makanan', 'Minuman', 'Paket', 'Layanan', 'Lainnya'] as const;
const sourceTypeOptions = [
  { value: 'owned', label: 'Milik usaha sendiri' },
  { value: 'consignment', label: 'Barang titipan' },
] as const;
const stockModeOptions = [
  { value: 'manual', label: 'Sudah dihitung' },
  { value: 'estimated', label: 'Masih perkiraan' },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  category: (typeof categoryOptions)[number];
  onCategoryChange: (value: (typeof categoryOptions)[number]) => void;
  sourceType: 'owned' | 'consignment';
  onSourceTypeChange: (value: 'owned' | 'consignment') => void;
  minStockAlert: string;
  onMinStockAlertChange: (value: string) => void;
  stockUnit: string;
  onStockUnitChange: (value: string) => void;
  stockMode: 'manual' | 'estimated';
  onStockModeChange: (value: 'manual' | 'estimated') => void;
  ownerLabel: string;
  onOwnerLabelChange: (value: string) => void;
  consignmentTerms: string;
  onConsignmentTermsChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
};

export function ProductDetailsModal(props: Props) {
  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-details-title"
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-[24px]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-portal-line px-4 py-3.5 sm:px-5">
          <div>
            <p id="product-details-title" className="text-base font-black text-portal-ink">Detail produk</p>
            <p className="mt-0.5 text-xs text-portal-soft">Isi seperlunya. Semua perubahan ikut tersimpan saat produk disimpan.</p>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Tutup detail" className="portal-button-ghost h-9 w-9 shrink-0 justify-center rounded-full p-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 text-sm font-semibold text-portal-ink">
                <span>Kategori</span>
                <ChoiceChips value={props.category} onChange={props.onCategoryChange} ariaLabel="Kategori produk" options={categoryOptions.map(value => ({ value, label: value }))} />
              </div>
              <div className="grid gap-2 text-sm font-semibold text-portal-ink">
                <span>Sumber barang</span>
                <ChoiceChips value={props.sourceType} onChange={props.onSourceTypeChange} ariaLabel="Sumber barang" options={sourceTypeOptions} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-portal-ink">
                Batas stok tipis
                <input type="number" inputMode="decimal" min="0" step="any" value={props.minStockAlert} onChange={event => props.onMinStockAlertChange(event.target.value)} placeholder="Contoh: 5" className="portal-input" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-portal-ink">
                Satuan stok
                <input maxLength={40} value={props.stockUnit} onChange={event => props.onStockUnitChange(event.target.value)} placeholder="pcs / botol / cup" className="portal-input" />
              </label>
            </div>

            <div className="grid gap-2 text-sm font-semibold text-portal-ink">
              <span>Cara menghitung stok</span>
              <ChoiceChips value={props.stockMode} onChange={props.onStockModeChange} ariaLabel="Cara menghitung stok" options={stockModeOptions} />
            </div>

            {props.sourceType === 'consignment' ? (
              <div className="grid gap-4 rounded-2xl bg-[#f7f8f5] p-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-portal-ink">
                  Nama penitip / supplier
                  <input value={props.ownerLabel} onChange={event => props.onOwnerLabelChange(event.target.value)} placeholder="Contoh: Bu Rini Snack" className="portal-input" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-portal-ink">
                  Aturan titip jual
                  <input value={props.consignmentTerms} onChange={event => props.onConsignmentTermsChange(event.target.value)} placeholder="Contoh: bagi hasil 80/20" className="portal-input" />
                </label>
              </div>
            ) : null}

            <label className="grid gap-2 text-sm font-semibold text-portal-ink">
              <span>Catatan <span className="font-normal text-portal-soft">(opsional)</span></span>
              <textarea value={props.notes} onChange={event => props.onNotesChange(event.target.value)} rows={3} placeholder="Contoh: paling laris pagi hari" className="portal-input min-h-24 resize-y" />
            </label>

            <button type="button" onClick={props.onClose} className="portal-button-primary min-h-11 w-full justify-center sm:w-auto sm:self-end">
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
