'use client';

import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, ExternalLink, Loader2, Phone, ShieldAlert, Video } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  ensureWebPushSubscription,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
} from '@/lib/browserNotifications';
import {
  readCallAlertPreferences,
  writeCallAlertPreferences,
} from '@/lib/callPreferences';

type Props = {
  locale: 'id' | 'en';
};

export function CallNotificationSettings({ locale }: Props) {
  const isId = locale === 'id';
  const [preferences, setPreferences] = useState(readCallAlertPreferences);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [pushReady, setPushReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sync = () => {
      setPreferences(readCallAlertPreferences());
      setPermission(
        'Notification' in window ? Notification.permission : 'denied',
      );
    };

    sync();
    window.addEventListener('lajukan:call-alert-preferences-changed', sync);
    return () =>
      window.removeEventListener(
        'lajukan:call-alert-preferences-changed',
        sync,
      );
  }, []);

  const enableNotifications = async () => {
    setBusy(true);
    try {
      if (!isBrowserNotificationSupported()) {
        writeCallAlertPreferences({
          enabled: true,
          browserNotifications: false,
        });
        setPreferences(readCallAlertPreferences());
        return;
      }

      const nextPermission =
        Notification.permission === 'granted'
          ? 'granted'
          : await requestBrowserNotificationPermission();

      setPermission(nextPermission);

      if (nextPermission === 'granted') {
        const synced = await ensureWebPushSubscription(
          typeof navigator !== 'undefined'
            ? navigator.userAgent.slice(0, 120)
            : 'web',
        );
        setPushReady(synced);
        writeCallAlertPreferences({
          enabled: true,
          browserNotifications: true,
        });
        setPreferences(readCallAlertPreferences());
      } else {
        writeCallAlertPreferences({
          enabled: true,
          browserNotifications: false,
        });
        setPreferences(readCallAlertPreferences());
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = (next: boolean) => {
    writeCallAlertPreferences({ enabled: next });
    setPreferences(readCallAlertPreferences());
  };

  const toggleRingtone = (next: boolean) => {
    writeCallAlertPreferences({ ringtone: next });
    setPreferences(readCallAlertPreferences());
  };

  return (
    <div className="mt-3 rounded-[18px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white/80 text-[color:var(--app-accent)] shadow-sm dark:bg-slate-900/60">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {isId ? 'Panggilan di luar chat' : 'Calls outside chat'}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Tetap dapat dering dan notifikasi saat kamu sedang membuka halaman lain atau tidak sedang di room chat. Browser bisa meminta izin notifikasi.'
                  : 'Keep getting call alerts while you are on another page or outside the chat room. Your browser may ask for notification permission.'}
              </p>
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--app-accent)]"
                checked={preferences.enabled}
                onChange={event => toggleEnabled(event.target.checked)}
              />
              {isId ? 'Aktif' : 'Enabled'}
            </label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-[14px] border border-white/70 bg-white/70 p-3 dark:border-white/5 dark:bg-slate-950/45">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]">
                  <Phone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {isId ? 'Dering panggilan' : 'Call ringtone'}
                  </p>
                  <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    {isId ? 'Boleh berbunyi saat ada call masuk.' : 'Allow incoming call sounds.'}
                  </p>
                </div>
                <label className="ml-auto inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--app-accent)]"
                    checked={preferences.ringtone}
                    onChange={event => toggleRingtone(event.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[14px] border border-white/70 bg-white/70 p-3 dark:border-white/5 dark:bg-slate-950/45">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]">
                  <Video className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {isId ? 'Web Push' : 'Web Push'}
                  </p>
                  <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    {permission === 'granted'
                      ? pushReady
                        ? isId
                          ? 'Siap dikirim meski tab tidak aktif.'
                          : 'Ready even when the tab is inactive.'
                        : isId
                          ? 'Izin ada, perangkat belum tersinkron.'
                          : 'Permission is granted but device is not synced.'
                      : isId
                        ? 'Perlu izin browser.'
                        : 'Browser permission required.'}
                  </p>
                </div>
                {permission === 'granted' && pushReady ? (
                  <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-600" />
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void enableNotifications()}
              disabled={busy}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-xs font-black text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] disabled:cursor-wait disabled:opacity-65"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BellRing className="h-4 w-4" />
              )}
              {permission === 'granted'
                ? isId
                  ? 'Sinkronkan perangkat'
                  : 'Sync this device'
                : isId
                  ? 'Aktifkan notifikasi'
                  : 'Enable notifications'}
            </button>

            <Link
              href="/calls"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 text-xs font-black text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-inverse)]"
            >
              <ExternalLink className="h-4 w-4" />
              {isId ? 'Buka riwayat panggilan' : 'Open call history'}
            </Link>
          </div>

          {permission === 'denied' ? (
            <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-4 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {isId
                  ? 'Izin notifikasi ditolak browser. Aktifkan kembali izin untuk situs Lajukan dari pengaturan browser.'
                  : 'Browser notifications are blocked. Re-enable permission for Lajukan in your browser site settings.'}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
