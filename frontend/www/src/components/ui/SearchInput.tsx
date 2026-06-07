'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type SearchInputLayout = 'row' | 'stack' | 'responsive';
type SearchInputVariant = 'hero' | 'navbar' | 'compact';

type SearchInputProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  ariaLabel?: string;
  inputAriaLabel?: string;
  className?: string;
  fieldClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  iconClassName?: string;
  compact?: boolean;
  showSubmitButton?: boolean;
  layout?: SearchInputLayout;
  variant?: SearchInputVariant;
  testId?: string;
  inputTestId?: string;
  submitTestId?: string;
  submitIcon?: ReactNode;
};

export function SearchInput({
  value,
  defaultValue = '',
  onValueChange,
  onSearch,
  placeholder,
  buttonLabel = 'Search',
  ariaLabel = 'Global search',
  inputAriaLabel = 'Search input',
  className,
  fieldClassName,
  inputClassName,
  buttonClassName,
  iconClassName,
  compact = false,
  showSubmitButton = true,
  layout = 'responsive',
  variant = 'hero',
  testId,
  inputTestId,
  submitTestId,
  submitIcon,
}: SearchInputProps) {
  const router = useRouter();
  const inputId = useId();
  const [internalQuery, setInternalQuery] = useState(defaultValue);
  const query = value ?? internalQuery;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = query.trim();
    if (onSearch) {
      onSearch(clean);
      return;
    }
    if (!clean) {
      router.push('/search');
      return;
    }
    router.push(`/search?q=${encodeURIComponent(clean)}`);
  };

  const onInputChange = (nextValue: string) => {
    if (value === undefined) {
      setInternalQuery(nextValue);
    }
    onValueChange?.(nextValue);
  };

  const layoutClassName =
    layout === 'row'
      ? 'flex-row items-center gap-1.5'
      : layout === 'stack'
        ? 'flex-col items-stretch gap-2'
        : 'flex-col items-stretch gap-2 min-[440px]:flex-row min-[440px]:items-center min-[440px]:gap-1.5';

  const variantClassName =
    variant === 'navbar'
      ? 'rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-0 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.22)] dark:border-[color:var(--app-border-strong)]'
      : variant === 'compact'
        ? 'rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-1.5 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.16)]'
        : 'max-w-[36rem] rounded-[18px] border border-[color:var(--app-border)] bg-white p-1.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)] dark:bg-[color:var(--app-surface-strong)]';
  const formSizeClassName =
    variant === 'navbar'
      ? compact
        ? 'min-h-[40px]'
        : 'min-h-[40px]'
      : compact
        ? 'min-h-[40px]'
        : 'min-h-[44px]';
  const fieldSizeClassName =
    variant === 'navbar'
      ? compact
        ? 'min-h-[34px]'
        : 'min-h-[36px]'
      : compact
        ? 'min-h-[34px]'
        : 'min-h-[36px]';

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'ui-search-form ui-field-shell flex w-full min-w-0',
        layoutClassName,
        variantClassName,
        formSizeClassName,
        className,
      )}
      role="search"
      aria-label={ariaLabel}
      data-search-variant={variant}
      data-testid={testId}
    >
      <label
        htmlFor={inputId}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-full px-2',
          fieldSizeClassName,
          variant === 'navbar' ? 'px-0' : 'bg-transparent',
          fieldClassName,
        )}
      >
        <Search
          className={cn(
            'h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]',
            iconClassName,
          )}
          aria-hidden="true"
        />
        <input
          id={inputId}
          aria-label={inputAriaLabel}
          data-testid={inputTestId}
          type="search"
          value={query}
          onChange={event => onInputChange(event.target.value)}
          placeholder={placeholder || 'Cari produk, jasa, atau lowongan'}
          className={cn(
            'min-h-0 w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-[13px] font-semibold text-[color:var(--app-text)] shadow-none outline-none placeholder:text-[color:var(--app-text-soft)] focus:border-0 focus:outline-none focus:ring-0',
            inputClassName,
          )}
        />
      </label>
      {showSubmitButton ? (
        <button
          type="submit"
          aria-label="Submit search"
          data-testid={submitTestId}
          className={cn(
            'ui-button-primary ui-pressable inline-flex shrink-0 items-center justify-center rounded-[14px] px-3 text-[13px] font-semibold',
            compact ? 'min-h-[36px] min-w-[76px]' : 'min-h-[40px] min-w-[88px]',
            layout === 'stack' && 'w-full',
            layout === 'responsive' && 'w-full min-[440px]:w-auto',
            buttonClassName,
          )}
        >
          {submitIcon || buttonLabel}
        </button>
      ) : null}
    </form>
  );
}
