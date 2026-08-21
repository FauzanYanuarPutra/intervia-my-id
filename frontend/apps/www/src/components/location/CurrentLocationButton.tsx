'use client';

import { LocateFixed, Loader2 } from 'lucide-react';

type CurrentLocationButtonProps = {
  isId?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function CurrentLocationButton({
  isId = true,
  loading,
  disabled,
  onClick,
}: CurrentLocationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex min-h-[46px] w-full items-center gap-3 rounded-[14px] px-3 text-left text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-200 dark:hover:bg-emerald-500/12"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-200">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LocateFixed className="h-4 w-4" />
        )}
      </span>
      <span>
        {loading
          ? isId
            ? 'Sedang mencari lokasi Anda...'
            : 'Finding your location...'
          : isId
            ? 'Gunakan lokasi saya saat ini'
            : 'Use my current location'}
      </span>
    </button>
  );
}
