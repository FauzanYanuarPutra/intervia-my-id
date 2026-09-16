'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
import {
  configuredPriceCents,
  defaultProductModifierSelections,
  orderedProductModifierGroups,
  productConfigurationSummary,
  validateProductModifierSelections,
  type ProductModifierGroup,
  type ProductModifierSelection,
} from 'lajukan-ui';
import { ModalSurface } from '@/components/interaction/ModalSurface';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  basePriceAmount: number;
  groups: ProductModifierGroup[];
  onConfirm: (input: {
    quantity: number;
    selectedOptions: ProductModifierSelection[];
    note: string;
    previewUnitPriceAmount: number;
    configurationSummary: string;
  }) => void;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function QuickSaleProductConfigurator({
  open,
  onOpenChange,
  productName,
  basePriceAmount,
  groups,
  onConfirm,
}: Props) {
  const orderedGroups = useMemo(() => orderedProductModifierGroups(groups), [groups]);
  const [selections, setSelections] = useState<ProductModifierSelection[]>(() => defaultProductModifierSelections(groups));
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const previewUnitPriceAmount = useMemo(
    () => Math.max(0, Math.round(configuredPriceCents(basePriceAmount * 100, groups, selections) / 100)),
    [basePriceAmount, groups, selections],
  );

  function close() {
    onOpenChange(false);
  }

  function updateSelection(group: ProductModifierGroup, optionId: string, checked: boolean) {
    setErrors(current => ({ ...current, [group.id]: '' }));
    setSelections(current => current.map(selection => {
      if (selection.group_id !== group.id) return selection;
      if (group.selection_mode === 'single') {
        return { ...selection, option_ids: checked ? [optionId] : [] };
      }
      const next = new Set(selection.option_ids);
      if (checked) next.add(optionId);
      else next.delete(optionId);
      return { ...selection, option_ids: [...next] };
    }));
  }

  function confirm() {
    const nextErrors = validateProductModifierSelections(groups, selections);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onConfirm({
      quantity,
      selectedOptions: selections.map(selection => ({ ...selection, option_ids: [...selection.option_ids] })),
      note: note.trim().replace(/\s+/g, ' '),
      previewUnitPriceAmount,
      configurationSummary: productConfigurationSummary(groups, selections),
    });
    setSelections(defaultProductModifierSelections(groups));
    setQuantity(1);
    setNote('');
    setErrors({});
    close();
  }

  return (
    <ModalSurface
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel={`Atur ${productName}`}
      presentation="adaptive"
      size="md"
    >
      <div className="flex min-h-0 max-h-[92dvh] flex-col">
        <header className="shrink-0 border-b border-portal-line px-4 py-3.5 sm:px-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-portal-soft">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wide">Pilihan pelanggan</span>
              </div>
              <h2 className="mt-1 truncate text-lg font-black text-portal-ink">{productName}</h2>
              <p className="mt-0.5 text-xs text-portal-soft">Pilih sesuai pesanan pelanggan. Pilihan wajib ditampilkan lebih dulu.</p>
            </div>
            <button type="button" aria-label="Tutup pilihan" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-portal-soft hover:bg-[#f2f4f1] hover:text-portal-ink" onClick={close}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="space-y-5">
            {orderedGroups.map(group => {
              const selected = selections.find(item => item.group_id === group.id)?.option_ids ?? [];
              return (
                <fieldset key={group.id}>
                  <div className="flex items-start justify-between gap-3">
                    <legend className="text-sm font-black text-portal-ink">{group.name}</legend>
                    <span className="shrink-0 text-[11px] font-semibold text-portal-soft">
                      {group.required ? 'Wajib' : group.selection_mode === 'multiple' ? `Maks. ${group.max_selections}` : 'Opsional'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {group.options.filter(option => option.enabled).map(option => {
                      const checked = selected.includes(option.id);
                      const limitReached = group.selection_mode === 'multiple' && !checked && selected.length >= group.max_selections;
                      return (
                        <label key={option.id} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 transition ${checked ? 'border-portal-forest bg-emerald-50/70' : 'border-portal-line bg-white hover:bg-[#fafbf9]'} ${limitReached ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                          <input
                            type={group.selection_mode === 'single' ? 'radio' : 'checkbox'}
                            name={group.selection_mode === 'single' ? `pos-${group.id}` : undefined}
                            checked={checked}
                            disabled={limitReached}
                            onChange={event => updateSelection(group, option.id, event.target.checked)}
                            className="h-5 w-5 shrink-0 accent-emerald-700"
                          />
                          <span className="min-w-0 flex-1 text-sm font-semibold text-portal-ink">{option.label}</span>
                          {option.price_delta_cents !== 0 ? (
                            <span className="shrink-0 text-xs font-bold text-portal-soft">
                              {option.price_delta_cents > 0 ? '+' : '-'}{money.format(Math.abs(Math.round(option.price_delta_cents / 100)))}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                  {errors[group.id] ? <p className="mt-1.5 text-xs font-semibold text-red-700">{errors[group.id]}</p> : null}
                </fieldset>
              );
            })}

            <section>
              <p className="text-sm font-black text-portal-ink">Jumlah racikan ini</p>
              <div className="mt-2 inline-flex items-center rounded-xl border border-portal-line bg-white p-1">
                <button type="button" aria-label="Kurangi jumlah" onClick={() => setQuantity(value => Math.max(1, value - 1))} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-[#f2f4f1]"><Minus className="h-4 w-4" /></button>
                <span className="min-w-12 text-center text-sm font-black tabular-nums">{quantity}</span>
                <button type="button" aria-label="Tambah jumlah" onClick={() => setQuantity(value => Math.min(200, value + 1))} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-[#f2f4f1]"><Plus className="h-4 w-4" /></button>
              </div>
            </section>

            <label className="grid gap-1.5 text-sm font-black text-portal-ink">
              Catatan <span className="font-normal text-portal-soft">(opsional)</span>
              <textarea value={note} maxLength={200} onChange={event => setNote(event.target.value)} rows={2} placeholder="Contoh: es sedikit" className="portal-input resize-none font-normal" />
            </label>
          </div>
        </div>

        <footer className="shrink-0 border-t border-portal-line bg-white px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
          <div className="mb-2 flex items-end justify-between gap-3">
            <span className="text-xs font-semibold text-portal-soft">{quantity} item</span>
            <strong className="text-lg tabular-nums text-portal-ink">{money.format(previewUnitPriceAmount * quantity)}</strong>
          </div>
          <button type="button" onClick={confirm} className="portal-button-primary w-full justify-center py-3.5 text-base">Tambah ke pesanan</button>
        </footer>
      </div>
    </ModalSurface>
  );
}
