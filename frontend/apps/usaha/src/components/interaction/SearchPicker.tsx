'use client';

import { useId, useState, type KeyboardEvent } from 'react';

type SearchPickerProps<T> = {
  items: T[];
  value: string;
  query: string;
  onQueryChange: (query: string) => void;
  onChange: (key: string) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getMeta?: (item: T) => string;
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
  ariaLabel: string;
  maxVisible?: number;
};

export function SearchPicker<T>({
  items,
  value,
  query,
  onQueryChange,
  onChange,
  getKey,
  getLabel,
  getMeta,
  placeholder,
  emptyLabel,
  disabled = false,
  ariaLabel,
  maxVisible = 50,
}: SearchPickerProps<T>) {
  const reactId = useId().replaceAll(':', '');
  const listboxId = `search-picker-${reactId}`;
  const [activeIndex, setActiveIndex] = useState(-1);
  const needle = query.trim().toLocaleLowerCase('id-ID');
  const matches = needle
    ? items.filter(item =>
        `${getLabel(item)} ${getMeta?.(item) ?? ''}`
          .toLocaleLowerCase('id-ID')
          .includes(needle),
      )
    : items;
  const selected = matches.find(item => getKey(item) === value);
  const limit = Math.max(1, maxVisible);
  const limited = matches.slice(0, limit);
  const visible = selected && !limited.some(item => getKey(item) === value)
    ? [selected, ...limited.slice(0, Math.max(0, limit - 1))]
    : limited;
  const hiddenCount = Math.max(0, matches.length - visible.length);
  const safeActiveIndex = visible.length
    ? Math.min(activeIndex, visible.length - 1)
    : -1;
  const activeItem = safeActiveIndex >= 0 ? visible[safeActiveIndex] : undefined;
  const activeOptionId = activeItem ? `${listboxId}-option-${safeActiveIndex}` : undefined;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      if (!visible.length) return;
      event.preventDefault();
      setActiveIndex(current => {
        const safeCurrent = current < 0 ? -1 : Math.min(current, visible.length - 1);
        return safeCurrent < 0 ? 0 : (safeCurrent + 1) % visible.length;
      });
      return;
    }
    if (event.key === 'ArrowUp') {
      if (!visible.length) return;
      event.preventDefault();
      setActiveIndex(current => {
        const safeCurrent = current < 0 ? -1 : Math.min(current, visible.length - 1);
        return safeCurrent < 0
          ? visible.length - 1
          : (safeCurrent - 1 + visible.length) % visible.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      if (!activeItem) return;
      event.preventDefault();
      onChange(getKey(activeItem));
      return;
    }
    if (event.key === 'Escape') {
      setActiveIndex(-1);
    }
  }

  return (
    <div aria-label={ariaLabel}>
      <input
        value={query}
        disabled={disabled}
        onChange={event => {
          onQueryChange(event.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="portal-input w-full"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label={`Cari ${ariaLabel.toLocaleLowerCase('id-ID')}`}
      />

      {hiddenCount ? (
        <p className="mt-2 text-[11px] text-portal-soft">
          Menampilkan {visible.length} dari {matches.length}. Ketik pencarian agar hasil lebih spesifik.
        </p>
      ) : null}

      <div
        id={listboxId}
        role="listbox"
        aria-label={`${ariaLabel} pilihan`}
        className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-portal-line bg-white"
      >
        {visible.length ? (
          visible.map((item, index) => {
            const key = getKey(item);
            const isSelected = key === value;
            const isActive = index === safeActiveIndex;

            return (
              <button
                id={`${listboxId}-option-${index}`}
                key={key}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                disabled={disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onChange(key)}
                className={`block w-full border-b border-portal-line px-3 py-2.5 text-left last:border-b-0 ${
                  isSelected || isActive ? 'bg-portal-mist' : 'bg-white hover:bg-[#fafbf9]'
                }`}
              >
                <span className="block text-sm font-bold text-portal-ink">{getLabel(item)}</span>
                {getMeta ? <span className="text-xs text-portal-soft">{getMeta(item)}</span> : null}
              </button>
            );
          })
        ) : (
          <p role="status" aria-live="polite" className="px-3 py-4 text-sm text-portal-soft">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}
