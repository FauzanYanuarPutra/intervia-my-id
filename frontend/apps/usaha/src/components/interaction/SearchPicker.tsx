'use client';

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

  return (
    <div aria-label={ariaLabel}>
      <input
        value={query}
        disabled={disabled}
        onChange={event => onQueryChange(event.target.value)}
        placeholder={placeholder}
        className="portal-input w-full"
        role="searchbox"
        aria-label={`Cari ${ariaLabel.toLocaleLowerCase('id-ID')}`}
      />

      {hiddenCount ? (
        <p className="mt-2 text-[11px] text-portal-soft">
          Menampilkan {visible.length} dari {matches.length}. Ketik pencarian agar hasil lebih spesifik.
        </p>
      ) : null}

      <div role="listbox" aria-label={`${ariaLabel} pilihan`} className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-portal-line bg-white">
        {visible.length ? (
          visible.map(item => {
            const key = getKey(item);
            const selected = key === value;

            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => onChange(key)}
                className={`block w-full border-b border-portal-line px-3 py-2.5 text-left last:border-b-0 ${
                  selected ? 'bg-portal-mist' : 'bg-white hover:bg-[#fafbf9]'
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
