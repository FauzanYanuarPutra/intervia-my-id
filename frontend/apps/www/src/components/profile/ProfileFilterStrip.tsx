import { cn } from '@/lib/utils';

type ProfileFilterStripItem<T extends string> = {
  key: T;
  label: string;
};

type ProfileFilterStripProps<T extends string> = {
  ariaLabel: string;
  items: Array<ProfileFilterStripItem<T>>;
  activeKey: T;
  onChange: (key: T) => void;
  className?: string;
};

export function ProfileFilterStrip<T extends string>({
  ariaLabel,
  items,
  activeKey,
  onChange,
  className,
}: ProfileFilterStripProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-filter-strip-fade
      className={cn(
        'relative min-w-0 overflow-x-auto overscroll-x-contain pr-3 [scrollbar-width:none] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-5 after:bg-gradient-to-l after:from-[color:var(--app-surface-strong)] after:to-transparent [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <div className="flex min-w-max items-center gap-1.5">
        {items.map(item => {
          const active = item.key === activeKey;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-pressed={active}
              className={cn(
                'inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 text-[11px] font-bold transition sm:min-h-9 sm:px-3.5 sm:text-xs',
                active
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/15'
                  : 'border-transparent bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:bg-emerald-50 hover:text-emerald-700 dark:bg-white/5 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
