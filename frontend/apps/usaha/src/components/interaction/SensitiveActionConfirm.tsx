'use client';

import { ModalSurface } from './ModalSurface';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  requireText?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SensitiveActionConfirm({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  busy = false,
  requireText = false,
  value = '',
  onValueChange,
  onConfirm,
  onCancel,
}: Props) {
  const confirmDisabled = busy || (requireText && value.trim().length < 3);

  return (
    <ModalSurface
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && !busy) onCancel();
      }}
      ariaLabel={title}
      size="sm"
      presentation="adaptive"
      dismissible={!busy}
    >
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-black text-portal-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-portal-soft">{description}</p>

        {requireText ? (
          <label className="mt-4 grid gap-1.5 text-xs font-semibold text-portal-soft">
            Alasan
            <input
              value={value}
              onChange={event => onValueChange?.(event.target.value)}
              className="portal-input"
              placeholder="Tulis alasan"
              minLength={3}
              maxLength={500}
              aria-describedby="sensitive-action-reason-help"
            />
            <span id="sensitive-action-reason-help" className="text-[11px] font-normal text-portal-soft">
              Minimal 3 karakter. Alasan ini ikut disimpan di riwayat perubahan.
            </span>
          </label>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="portal-button-secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="min-h-10 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {busy ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </ModalSurface>
  );
}
