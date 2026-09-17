'use client';

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
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map(option => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={selected ? 'merchant-chip merchant-chip-active' : 'merchant-chip'}
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
