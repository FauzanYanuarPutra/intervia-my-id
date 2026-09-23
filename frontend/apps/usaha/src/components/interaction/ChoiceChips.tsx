'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ModalSurface } from './ModalSurface';

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type ChoiceChipsProps<T extends string> = {
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
};

export function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: ChoiceChipsProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  const usePicker = options.length > 4;

  if (usePicker) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={() => setOpen(true)}
          className="flex min-h-11 w-full items-center gap-3 rounded-[12px] border border-portal-line bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-portal-ink transition hover:border-portal-forest/25 hover:bg-portal-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">{selected?.label ?? 'Pilih'}</span>
            {selected?.description ? (
              <span className="mt-0.5 block truncate text-[11px] font-normal text-portal-soft">
                {selected.description}
              </span>
            ) : null}
          </span>
          <ChevronDown className={open ? 'h-4 w-4 shrink-0 rotate-180 text-portal-soft transition' : 'h-4 w-4 shrink-0 text-portal-soft transition'} />
        </button>

        <ModalSurface
          open={open}
          onOpenChange={setOpen}
          ariaLabel={ariaLabel}
          presentation="adaptive"
          size="sm"
        >
          <div className="flex min-h-0 max-h-[min(78dvh,34rem)] flex-col">
            <div className="border-b border-portal-line px-4 py-3.5">
              <p className="text-base font-black text-portal-ink">{ariaLabel}</p>
              <p className="mt-0.5 text-xs text-portal-soft">Pilih satu. Pilihan lain tidak perlu dibuka di halaman utama.</p>
            </div>
            <div className="min-h-0 overflow-y-auto p-2">
              {options.map(option => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-portal-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20"
                  >
                    <span className={active ? 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-portal-mist text-portal-forest' : 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-portal-surface-soft text-portal-soft'}>
                      {active ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-portal-ink">{option.label}</span>
                      {option.description ? (
                        <span className="mt-0.5 block text-xs leading-5 text-portal-soft">{option.description}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </ModalSurface>
      </>
    );
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={active ? 'merchant-chip merchant-chip-active' : 'merchant-chip'}
          >
            <span>
              {option.label}
              {option.description ? (
                <span className="mt-0.5 block text-[11px] font-normal opacity-80">
                  {option.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
