'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { ChevronDown, X } from 'lucide-react';

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
  mode?: 'inline' | 'modal';
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
  mode = 'inline',
}: SearchPickerProps<T>) {
  const reactId = useId().replaceAll(':', '');
  const listboxId = `search-picker-${reactId}`;
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const needle = query.trim().toLocaleLowerCase('id-ID');
  const matches = needle
    ? items.filter(item =>
        `${getLabel(item)} ${getMeta?.(item) ?? ''}`
          .toLocaleLowerCase('id-ID')
          .includes(needle),
      )
    : items;
  const selected = items.find(item => getKey(item) === value);
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

  function selectValue(key: string) {
    onChange(key);
    setActiveIndex(-1);
    if (mode === 'modal') {
      onQueryChange('');
      setIsOpen(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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
      selectValue(getKey(activeItem));
      return;
    }

    if (event.key === 'Escape') {
      setActiveIndex(-1);
    }
  }

  const selectedMeta = selected && getMeta ? getMeta(selected) : '';

  if (mode === 'modal') {
    return (
      <div aria-label={ariaLabel}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onQueryChange('');
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-portal-line bg-white px-3 py-2.5 text-left text-sm text-portal-ink hover:border-portal-forest/40 disabled:cursor-not-allowed disabled:opacity-60"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={ariaLabel}
        >
          <span className="min-w-0">
            <span className={selected ? 'block truncate font-semibold' : 'block truncate text-portal-soft'}>
              {selected ? getLabel(selected) : placeholder}
            </span>
            {selected && selectedMeta ? (
              <span className="mt-0.5 block truncate text-[11px] text-portal-soft">{selectedMeta}</span>
            ) : null}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-portal-soft" />
        </button>

        {isOpen ? (
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4"
            role="presentation"
            onMouseDown={event => {
              if (event.target === event.currentTarget) setIsOpen(false);
            }}
          >
            <div
              className="w-full max-w-xl overflow-hidden rounded-t-2xl border border-portal-line bg-white shadow-2xl sm:rounded-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              onMouseDown={event => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-portal-line px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-bold text-portal-ink">{ariaLabel}</p>
                  <p className="mt-0.5 text-xs text-portal-soft">Cari lalu pilih satu. Daftar tidak memenuhi halaman utama.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onQueryChange('');
                    setActiveIndex(-1);
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-portal-soft hover:bg-portal-mist hover:text-portal-ink"
                  aria-label="Tutup pilihan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 sm:p-4">
                <input
                  autoFocus
                  value={query}
                  disabled={disabled}
                  onChange={event => {
                    onQueryChange(event.target.value);
                    setActiveIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
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
                  className="mt-3 max-h-[min(60vh,420px)] overflow-y-auto rounded-xl border border-portal-line bg-white"
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
                          onClick={() => selectValue(key)}
                          className={`block w-full border-b border-portal-line px-3 py-3 text-left last:border-b-0 ${
                            isSelected || isActive ? 'bg-portal-mist' : 'bg-white hover:bg-[#fafbf9]'
                          }`}
                        >
                          <span className="block text-sm font-bold text-portal-ink">{getLabel(item)}</span>
                          {getMeta ? <span className="text-xs text-portal-soft">{getMeta(item)}</span> : null}
                        </button>
                      );
                    })
                  ) : (
                    <p role="status" aria-live="polite" className="px-3 py-6 text-sm text-portal-soft">
                      {emptyLabel}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
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
        onKeyDown={handleKeyDown}
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
                onClick={() => selectValue(key)}
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
