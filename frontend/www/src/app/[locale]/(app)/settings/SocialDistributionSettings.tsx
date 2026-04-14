'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Link2, Save, Unplug, Wand2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  readSocialConnections,
  type SocialChannelId,
  type SocialConnection,
  type SocialConnectionMap,
} from '@/lib/content/distribution';

type Props = {
  locale: 'id' | 'en';
};

type DraftMap = Record<SocialChannelId, SocialConnection>;

const CHANNELS: Array<{
  id: SocialChannelId;
  label: string;
  accountTypes: Array<{ value: string; id: string; en: string }>;
  helperId: string;
  helperEn: string;
  loginUrl: string;
}> = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    accountTypes: [
      { value: 'profile', id: 'Profil', en: 'Profile' },
      { value: 'company', id: 'Company Page', en: 'Company Page' },
    ],
    helperId: 'Paling siap untuk distribusi B2B dan posting profesional.',
    helperEn: 'Best-ready path for B2B distribution and professional posting.',
    loginUrl: 'https://www.linkedin.com/',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    accountTypes: [
      { value: 'professional', id: 'Professional', en: 'Professional' },
      { value: 'creator', id: 'Creator', en: 'Creator' },
    ],
    helperId: 'Siapkan akun professional agar nanti bisa masuk alur distribusi Meta.',
    helperEn: 'Prepare a professional account so it can enter the Meta distribution flow later.',
    loginUrl: 'https://www.instagram.com/',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    accountTypes: [
      { value: 'page', id: 'Page', en: 'Page' },
      { value: 'business', id: 'Business', en: 'Business' },
    ],
    helperId: 'Gunakan Page bisnis untuk share link dan distribusi komunitas.',
    helperEn: 'Use a business Page for link sharing and community distribution.',
    loginUrl: 'https://www.facebook.com/',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    accountTypes: [
      { value: 'business', id: 'Business', en: 'Business' },
      { value: 'creator', id: 'Creator', en: 'Creator' },
    ],
    helperId: 'Siapkan akun creator/business dulu. Publish API bisa disambung setelah audit siap.',
    helperEn: 'Prepare a creator/business account first. The publish API can be attached once the audit is ready.',
    loginUrl: 'https://www.tiktok.com/login',
  },
  {
    id: 'x',
    label: 'X',
    accountTypes: [
      { value: 'profile', id: 'Profil', en: 'Profile' },
      { value: 'brand', id: 'Brand', en: 'Brand' },
    ],
    helperId: 'Cocok untuk teaser singkat dan distribusi traffic cepat.',
    helperEn: 'Useful for short teasers and quick-traffic distribution.',
    loginUrl: 'https://x.com/i/flow/login',
  },
];

function normalizeDraftMap(value: SocialConnectionMap): DraftMap {
  return {
    linkedin: value.linkedin || { channel: 'linkedin', enabled: false },
    instagram: value.instagram || { channel: 'instagram', enabled: false },
    facebook: value.facebook || { channel: 'facebook', enabled: false },
    tiktok: value.tiktok || { channel: 'tiktok', enabled: false },
    x: value.x || { channel: 'x', enabled: false },
    whatsapp: value.whatsapp || { channel: 'whatsapp', enabled: false },
    telegram: value.telegram || { channel: 'telegram', enabled: false },
  };
}

export function SocialDistributionSettings({ locale }: Props) {
  const isId = locale === 'id';
  const { user, authFetch, refreshUser } = useAuth();
  const currentConnections = useMemo(
    () => readSocialConnections(user?.metadata || {}),
    [user?.metadata],
  );
  const [drafts, setDrafts] = useState<DraftMap>(() =>
    normalizeDraftMap(currentConnections),
  );
  const [savingChannel, setSavingChannel] = useState<SocialChannelId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(normalizeDraftMap(currentConnections));
  }, [currentConnections]);

  if (!user) {
    return (
      <div
        id="distribution"
        className="ui-panel ui-feed-section rounded-none border-x-0 p-5 sm:rounded-[var(--app-radius)] sm:border-x"
      >
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {isId ? 'Distribusi & channel posting' : 'Distribution and posting channels'}
          </h2>
          <p className="text-xs text-[color:var(--app-text-soft)]">
            {isId
              ? 'Masuk dulu supaya target akun dan page bisa disimpan untuk Share Pack.'
              : 'Sign in first so your account and page targets can be saved for Share Pack.'}
          </p>
        </div>
      </div>
    );
  }

  const updateDraft = (
    channel: SocialChannelId,
    patch: Partial<SocialConnection>,
  ) => {
    setDrafts(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        ...patch,
      },
    }));
  };

  const saveChannel = async (channel: SocialChannelId) => {
    if (!user) return;
    setSavingChannel(channel);
    setMessage(null);
    try {
      const nextConnections: SocialConnectionMap = {
        ...currentConnections,
        [channel]: {
          ...drafts[channel],
          channel,
          enabled: Boolean(drafts[channel].enabled && drafts[channel].label),
          connectedAt: drafts[channel].enabled
            ? drafts[channel].connectedAt || new Date().toISOString()
            : '',
        },
      };

      const metadata = {
        ...(user.metadata || {}),
        social_connections: nextConnections,
      };

      const res = await authFetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          payload.error ||
            (isId ? 'Gagal menyimpan koneksi channel.' : 'Failed to save the channel connection.'),
        );
      }
      await refreshUser();
      setMessage(
        isId
          ? 'Koneksi distribusi tersimpan. Share Pack akan memakai target ini.'
          : 'Distribution connection saved. Share Pack will use this target.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : isId
            ? 'Terjadi error saat menyimpan koneksi channel.'
            : 'An error occurred while saving the channel connection.',
      );
    } finally {
      setSavingChannel(null);
    }
  };

  const disconnectChannel = async (channel: SocialChannelId) => {
    updateDraft(channel, {
      enabled: false,
      label: '',
      handle: '',
      targetUrl: '',
      notes: '',
      connectedAt: '',
    });
    setMessage(
      isId
        ? 'Edit lalu simpan kalau ingin memutus koneksi channel.'
        : 'Edit and save if you want to disconnect the channel.',
    );
  };

  return (
    <div
      id="distribution"
      className="ui-panel ui-feed-section rounded-none border-x-0 p-5 sm:rounded-[var(--app-radius)] sm:border-x"
    >
      <div className="space-y-1">
        <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {isId ? 'Distribusi & channel posting' : 'Distribution and posting channels'}
        </h2>
        <p className="text-xs text-[color:var(--app-text-soft)]">
          {isId
            ? 'Lajukan tidak menyimpan password platform. Bagian ini dipakai untuk menyimpan target akun/page yang akan dipakai Share Pack dan jalur distribusi resmi berikutnya.'
            : 'Lajukan does not store platform passwords. This section stores the account/page targets used by Share Pack and the next official distribution flow.'}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {CHANNELS.map(channel => {
          const draft = drafts[channel.id];
          const active = Boolean(draft.enabled && draft.label);
          return (
            <div
              key={channel.id}
              className="ui-feed-row flex flex-col gap-3 rounded-[22px] border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {channel.label}
                    </p>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {active
                        ? isId
                          ? 'Siap dipakai'
                          : 'Ready'
                        : isId
                          ? 'Belum terhubung'
                          : 'Not connected'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                    {isId ? channel.helperId : channel.helperEn}
                  </p>
                </div>
                <a
                  href={channel.loginUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {isId ? 'Buka login resmi' : 'Open official login'}
                </a>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={draft.label || ''}
                  onChange={event =>
                    updateDraft(channel.id, { label: event.target.value })
                  }
                  placeholder={isId ? 'Nama akun / page / brand' : 'Account / page / brand name'}
                  className="ui-control w-full px-3 text-sm"
                />
                <input
                  value={draft.handle || ''}
                  onChange={event =>
                    updateDraft(channel.id, { handle: event.target.value })
                  }
                  placeholder={isId ? 'Handle / username' : 'Handle / username'}
                  className="ui-control w-full px-3 text-sm"
                />
                <input
                  value={draft.targetUrl || ''}
                  onChange={event =>
                    updateDraft(channel.id, { targetUrl: event.target.value })
                  }
                  placeholder={isId ? 'URL akun / page target' : 'Target account / page URL'}
                  className="ui-control w-full px-3 text-sm sm:col-span-2"
                />
                <select
                  value={draft.accountType || channel.accountTypes[0]?.value || 'profile'}
                  onChange={event =>
                    updateDraft(channel.id, { accountType: event.target.value })
                  }
                  className="ui-control w-full px-3 text-sm"
                >
                  {channel.accountTypes.map(option => (
                    <option key={option.value} value={option.value}>
                      {isId ? option.id : option.en}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.notes || ''}
                  onChange={event =>
                    updateDraft(channel.id, { notes: event.target.value })
                  }
                  placeholder={isId ? 'Catatan posting / target audience' : 'Posting notes / target audience'}
                  className="ui-control w-full px-3 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateDraft(channel.id, { enabled: !draft.enabled })}
                  className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-semibold ${
                    draft.enabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'border-[color:var(--app-border)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)]'
                  }`}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {draft.enabled
                    ? isId
                      ? 'Aktif untuk Share Pack'
                      : 'Enabled for Share Pack'
                    : isId
                      ? 'Aktifkan di Share Pack'
                      : 'Enable in Share Pack'}
                </button>
                <button
                  type="button"
                  onClick={() => void saveChannel(channel.id)}
                  disabled={savingChannel === channel.id}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-semibold text-[color:var(--app-accent)] disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingChannel === channel.id
                    ? '...'
                    : isId
                      ? 'Simpan target'
                      : 'Save target'}
                </button>
                <button
                  type="button"
                  onClick={() => disconnectChannel(channel.id)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)]"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  {isId ? 'Reset' : 'Reset'}
                </button>
                {draft.targetUrl ? (
                  <a
                    href={draft.targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)]"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {isId ? 'Buka target' : 'Open target'}
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {message ? (
        <p className="mt-3 text-xs text-[color:var(--app-text-soft)]">{message}</p>
      ) : null}
    </div>
  );
}
