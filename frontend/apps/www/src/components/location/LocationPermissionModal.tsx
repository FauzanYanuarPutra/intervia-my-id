'use client';

import { LocateFixed, MapPin, Settings2, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LocationPermissionModalState =
  | 'prompt'
  | 'denied'
  | 'unsupported'
  | 'error';

type LocationPermissionModalProps = {
  open: boolean;
  state: LocationPermissionModalState;
  isId?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onRetry: () => void;
  onClose: () => void;
};

export function LocationPermissionModal({
  open,
  state,
  isId = true,
  loading = false,
  onConfirm,
  onRetry,
  onClose,
}: LocationPermissionModalProps) {
  if (!open) return null;

  const copy = isId
    ? {
        promptTitle: 'Boleh pakai lokasi Anda?',
        promptBody:
          'Lajukan akan memakai lokasi perangkat hanya untuk menemukan alamat terdekat. Lokasi tidak akan dipublikasikan sebagai alamat rumah Anda.',
        promptPrimary: 'Izinkan lokasi',
        deniedTitle: 'Lokasi sedang diblokir',
        deniedBody:
          'Browser sebelumnya menolak akses lokasi. Aktifkan izin Lokasi untuk situs ini dari pengaturan situs/browser, lalu tekan Coba lagi.',
        deniedHint:
          'Biasanya: klik ikon pengaturan/gembok di sebelah alamat situs → Lokasi → Izinkan.',
        retry: 'Coba lagi',
        unsupportedTitle: 'Lokasi perangkat tidak tersedia',
        unsupportedBody:
          'Browser/perangkat ini tidak menyediakan akses lokasi otomatis. Anda tetap bisa mencari alamat atau memilih usaha yang sudah terdaftar.',
        errorTitle: 'Lokasi belum bisa dipakai',
        errorBody:
          'Akses lokasi gagal diproses. Coba lagi atau pilih lokasi secara manual.',
        close: 'Tutup',
      }
    : {
        promptTitle: 'Use your current location?',
        promptBody:
          'Lajukan will use your device location only to find the nearest address. Your home address will not be published automatically.',
        promptPrimary: 'Allow location',
        deniedTitle: 'Location is blocked',
        deniedBody:
          'The browser previously denied location access. Allow Location for this site in your browser/site settings, then try again.',
        deniedHint:
          'Usually: open the site controls next to the address bar → Location → Allow.',
        retry: 'Try again',
        unsupportedTitle: 'Device location is unavailable',
        unsupportedBody:
          'This browser/device does not provide automatic geolocation. You can still search for an address or choose a registered business.',
        errorTitle: 'Location is not ready',
        errorBody:
          'Location access could not be completed. Try again or choose a location manually.',
        close: 'Close',
      };

  const title =
    state === 'prompt'
      ? copy.promptTitle
      : state === 'denied'
        ? copy.deniedTitle
        : state === 'unsupported'
          ? copy.unsupportedTitle
          : copy.errorTitle;

  const body =
    state === 'prompt'
      ? copy.promptBody
      : state === 'denied'
        ? copy.deniedBody
        : state === 'unsupported'
          ? copy.unsupportedBody
          : copy.errorBody;

  return (
    <div
      className="ui-layer-modal fixed inset-0 z-[160000] flex items-end bg-black/60 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-permission-title"
    >
      <button
        type="button"
        aria-label={copy.close}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <section className="relative w-full max-w-[430px] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_90px_-36px_rgba(15,23,42,0.55)] dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
                state === 'denied'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-200'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200',
              )}
            >
              {state === 'denied' ? (
                <Settings2 className="h-5 w-5" />
              ) : state === 'prompt' ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <MapPin className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p
                id="location-permission-title"
                className="text-base font-black text-slate-950 dark:text-white"
              >
                {title}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {isId ? 'Lokasi untuk postingan' : 'Location for this listing'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={copy.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            {body}
          </p>

          {state === 'prompt' ? (
            <div className="rounded-2xl bg-emerald-50 p-3.5 text-xs font-semibold leading-5 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
              <div className="flex items-start gap-2.5">
                <LocateFixed className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {isId
                    ? 'Setelah Anda menekan tombol, browser akan menampilkan permintaan izin Lokasi.'
                    : 'After you continue, your browser will show its Location permission prompt.'}
                </span>
              </div>
            </div>
          ) : null}

          {state === 'denied' ? (
            <div className="rounded-2xl bg-amber-50 p-3.5 text-xs font-semibold leading-5 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
              <div className="flex items-start gap-2.5">
                <Settings2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{copy.deniedHint}</span>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {copy.close}
            </button>

            {state === 'prompt' ? (
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <LocateFixed className="h-4 w-4" />
                {copy.promptPrimary}
              </button>
            ) : state === 'denied' || state === 'error' ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <LocateFixed className="h-4 w-4" />
                {copy.retry}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
