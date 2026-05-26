'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDialog } from '@/components/system/feedback/DialogProvider';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useUISettings } from '@/context/UISettingsContext';
import {
  MAX_SAVED_ACCOUNTS,
  formatSavedAccountIdentifier,
  readSavedAccounts,
  removeSavedAccount,
  saveAccountSnapshot,
  type SavedAccount,
} from '@/lib/accountVault';
import { mapCommonAuthError } from '@/lib/authErrors';
import { validatePasswordStrength } from '@/lib/passwordPolicy';
import {
  Laptop,
  LogOut,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { SocialDistributionSettings } from './SocialDistributionSettings';

type ActionState = 'idle' | 'loading' | 'success' | 'error';

type UserSession = {
  id: string;
  deviceName?: string | null;
  deviceType?: string | null;
  location?: string | null;
  lastActiveAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  isCurrent?: boolean;
};

function detectLocale(pathname: string): 'id' | 'en' {
  return pathname.startsWith('/id') ? 'id' : 'en';
}

function getAccountInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'A';
}

function formatSessionTime(
  value: UserSession['lastActiveAt'],
  locale: 'id' | 'en',
): string {
  if (!value) return locale === 'id' ? 'Belum tercatat' : 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === 'id' ? 'Belum tercatat' : 'Not recorded';
  }
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {title}
      </h2>
      {description ? (
        <p className="text-xs text-[color:var(--app-text-soft)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-feed-row flex flex-col gap-3 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.24)] sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/72">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {label}
        </p>
        {description ? (
          <p className="text-xs text-[color:var(--app-text-soft)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="w-full sm:max-w-[240px]">{children}</div>
    </div>
  );
}

const SETTINGS_CONTROL_CLASS =
  'min-h-[46px] w-full rounded-[14px] border-2 border-slate-300 bg-white px-3.5 text-sm font-semibold text-[color:var(--app-text)] shadow-none outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[color:var(--app-accent)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--app-accent)_16%,transparent)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-emerald-400 dark:disabled:border-slate-800 dark:disabled:bg-slate-900/70';
const SETTINGS_SELECT_CLASS = `${SETTINGS_CONTROL_CLASS} appearance-none pr-9`;
const SETTINGS_TEXTAREA_CLASS = `${SETTINGS_CONTROL_CLASS} min-h-[92px] resize-y py-3 leading-6`;

function Toggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="relative inline-flex cursor-pointer items-center"
    >
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
      />
      <span className="h-6 w-11 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] transition peer-checked:border-[color:var(--app-accent-border)] peer-checked:bg-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]" />
      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-[color:var(--app-text-inverse)] transition peer-checked:translate-x-5" />
    </label>
  );
}

function mapPasswordPolicyError(
  message: string | null,
  locale: 'id' | 'en',
): string | null {
  if (!message) return null;
  if (locale !== 'id') return message;

  if (message.includes('at least')) {
    return 'Password minimal 10 karakter.';
  }
  if (message.includes('uppercase')) {
    return 'Password harus punya minimal satu huruf besar.';
  }
  if (message.includes('lowercase')) {
    return 'Password harus punya minimal satu huruf kecil.';
  }
  if (message.includes('number')) {
    return 'Password harus punya minimal satu angka.';
  }
  if (message.includes('symbol')) {
    return 'Password harus punya minimal satu simbol.';
  }
  if (message.includes('spaces')) {
    return 'Password tidak boleh mengandung spasi.';
  }
  return message;
}

export default function SettingsPage() {
  const pathname = usePathname();
  const locale = detectLocale(pathname || '');
  const { confirm } = useDialog();
  const { authFetch, logout, refreshUser, user } = useAuth();
  const {
    colorScheme,
    themePreset,
    colorVision,
    setColorScheme,
    setThemePreset,
    setColorVision,
  } = useTheme();
  const {
    fontSize,
    fontFamily,
    density,
    reduceMotion,
    setFontSize,
    setFontFamily,
    setDensity,
    setReduceMotion,
  } = useUISettings();

  const [exportState, setExportState] = useState<ActionState>('idle');
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [passwordState, setPasswordState] = useState<ActionState>('idle');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteState, setDeleteState] = useState<ActionState>('idle');
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsState, setSessionsState] = useState<ActionState>('idle');
  const [sessionsMessage, setSessionsMessage] = useState<string | null>(null);
  const [sessionActionId, setSessionActionId] = useState<string | null>(null);

  const text = {
    title: locale === 'id' ? 'Pengaturan' : 'Settings',
    subtitle:
      locale === 'id'
        ? 'Atur tampilan dan akun.'
        : 'Tune appearance, accessibility, and account data quickly.',
    appearance: locale === 'id' ? 'Tampilan' : 'Appearance',
    appearanceDesc:
      locale === 'id'
        ? 'Mode, warna, kerapatan.'
        : 'Choose light or dark mode and the brand palette that feels best.',
    typography: locale === 'id' ? 'Tipografi' : 'Typography',
    typographyDesc:
      locale === 'id'
        ? 'Ukuran dan jenis font.'
        : 'Adjust font size and family for readability.',
    accessibility: locale === 'id' ? 'Aksesibilitas' : 'Accessibility',
    accessibilityDesc:
      locale === 'id'
        ? 'Kurangi gerakan, tambah kontras.'
        : 'Controls to reduce motion and improve contrast.',
    account: locale === 'id' ? 'Akun & Data' : 'Account & Data',
    accountDesc:
      locale === 'id'
        ? 'Akun, sesi, password, export.'
        : 'Manage account switching, device sessions, password, data export, and deletion.',
    savedAccounts: locale === 'id' ? 'Akun tersimpan' : 'Saved accounts',
    savedAccountsDesc:
      locale === 'id'
        ? 'Simpan shortcut akun di perangkat ini.'
        : 'Keep up to 8 account shortcuts on this device. Switching signs out first and the next account still requires OTP.',
    savedAccountsSecure:
      locale === 'id'
        ? 'Aman: tidak simpan token/password.'
        : 'Safe: only name and phone/email are stored, never tokens or passwords.',
    savedAccountLimit: locale === 'id' ? 'Slot akun' : 'Account slots',
    currentAccount: locale === 'id' ? 'Aktif sekarang' : 'Current',
    switchAccount: locale === 'id' ? 'Pakai akun ini' : 'Use this account',
    removeShortcut: locale === 'id' ? 'Hapus shortcut' : 'Remove shortcut',
    addAnotherAccount:
      locale === 'id'
        ? 'Tambah / login akun lain'
        : 'Add / sign in another account',
    noSavedAccounts:
      locale === 'id'
        ? 'Akun aktif otomatis muncul di sini.'
        : 'The active account is added automatically after the profile loads.',
    sessionsTitle: locale === 'id' ? 'Perangkat & sesi' : 'Devices & sessions',
    sessionsDesc:
      locale === 'id'
        ? 'Cek perangkat. Cabut yang asing.'
        : 'Review signed-in devices and revoke sessions you do not recognize.',
    refreshSessions: locale === 'id' ? 'Refresh sesi' : 'Refresh sessions',
    currentDevice: locale === 'id' ? 'Perangkat ini' : 'This device',
    revokeSession: locale === 'id' ? 'Cabut' : 'Revoke',
    revokeOtherDevices:
      locale === 'id' ? 'Keluar dari perangkat lain' : 'Sign out other devices',
    sessionsEmpty:
      locale === 'id'
        ? 'Belum ada sesi perangkat lain.'
        : 'No other device sessions yet.',
    sessionsFailed:
      locale === 'id'
        ? 'Gagal mengambil sesi perangkat.'
        : 'Failed to load device sessions.',
    sessionRevoked:
      locale === 'id' ? 'Sesi perangkat dicabut.' : 'Device session revoked.',
    sessionsUpdated:
      locale === 'id'
        ? 'Sesi perangkat diperbarui.'
        : 'Device sessions updated.',
    revokeFailed:
      locale === 'id' ? 'Gagal mencabut sesi.' : 'Failed to revoke session.',
    switchConfirmTitle: locale === 'id' ? 'Switch akun?' : 'Switch account?',
    switchConfirmDesc:
      locale === 'id'
        ? 'Akun ini keluar dulu. Lanjut login akun pilihan.'
        : 'This session will sign out first. You will go to login with the selected account.',
    removeShortcutConfirm:
      locale === 'id'
        ? 'Hapus shortcut akun dari perangkat ini?'
        : 'Remove this account shortcut from this device?',
    logoutOtherConfirm:
      locale === 'id'
        ? 'Keluar dari semua perangkat lain?'
        : 'Sign out from all other devices?',
    passwordCard: locale === 'id' ? 'Password akun' : 'Account password',
    passwordDesc:
      locale === 'id'
        ? 'Login utama tetap nomor HP + OTP.'
        : 'The main login still uses phone + OTP. This password only exists for later Settings or advanced flows.',
    createPassword: locale === 'id' ? 'Buat Password' : 'Create Password',
    changePassword: locale === 'id' ? 'Ganti Password' : 'Change Password',
    currentPassword: locale === 'id' ? 'Password sekarang' : 'Current password',
    currentPasswordHint:
      locale === 'id'
        ? 'Kosongkan kalau belum punya password.'
        : 'Leave this empty because this account does not have a password yet.',
    newPassword: locale === 'id' ? 'Password baru' : 'New password',
    confirmPassword:
      locale === 'id' ? 'Konfirmasi password baru' : 'Confirm new password',
    passwordMismatch:
      locale === 'id'
        ? 'Konfirmasi password tidak cocok.'
        : 'Password confirmation does not match.',
    passwordSuccess:
      locale === 'id'
        ? 'Password akun berhasil disimpan.'
        : 'Account password has been saved.',
    passwordFailed:
      locale === 'id'
        ? 'Gagal menyimpan password.'
        : 'Failed to save password.',
    deleteSetupFirst:
      locale === 'id'
        ? 'Buat password dulu.'
        : 'Create a password above before deleting the account.',
    themeMode: locale === 'id' ? 'Mode Tema' : 'Theme Mode',
    themeModeDesc:
      locale === 'id'
        ? 'Pilih otomatis, terang, atau gelap.'
        : 'Pick system, light, or dark.',
    themePreset: locale === 'id' ? 'Preset Tema' : 'Theme Preset',
    themePresetDesc:
      locale === 'id'
        ? 'Pilih palet.'
        : 'Pick the primary palette: Lajukan, mono, ocean, sunset, or orchid.',
    colorVision: locale === 'id' ? 'Mode Warna' : 'Color Vision',
    colorVisionDesc:
      locale === 'id'
        ? 'Kontras tinggi atau colorblind.'
        : 'Optimize for high contrast or colorblind.',
    density: locale === 'id' ? 'Kerapatan' : 'Density',
    densityDesc:
      locale === 'id'
        ? 'Ringkas atau lega.'
        : 'Choose compact or comfortable spacing.',
    fontSize: locale === 'id' ? 'Ukuran Font' : 'Font Size',
    fontFamily: locale === 'id' ? 'Keluarga Font' : 'Font Family',
    reduceMotion: locale === 'id' ? 'Kurangi Animasi' : 'Reduce Motion',
    reduceMotionDesc:
      locale === 'id'
        ? 'Matikan animasi.'
        : 'Disable animations for a steadier feel.',
    exportData: locale === 'id' ? 'Export Data' : 'Export Data',
    exportDesc:
      locale === 'id'
        ? 'Unduh arsip data akun Anda.'
        : 'Request a downloadable archive of your data.',
    exportCta: locale === 'id' ? 'Mulai Export' : 'Request Export',
    deleteAccount: locale === 'id' ? 'Hapus Akun' : 'Delete Account',
    deleteDesc:
      locale === 'id'
        ? 'Penghapusan akun bersifat permanen.'
        : 'Account deletion is permanent.',
    deleteCta: locale === 'id' ? 'Hapus Akun' : 'Delete Account',
    deletePassword: locale === 'id' ? 'Password akun' : 'Account password',
    deleteReason: locale === 'id' ? 'Alasan (opsional)' : 'Reason (optional)',
    deleteConfirm:
      locale === 'id'
        ? 'Apakah Anda yakin ingin menghapus akun?'
        : 'Are you sure you want to delete this account?',
    deletePasswordRequired:
      locale === 'id'
        ? 'Password diperlukan untuk menghapus akun.'
        : 'Password is required to delete the account.',
    deleteSuccess:
      locale === 'id'
        ? 'Permintaan hapus akun diproses.'
        : 'Account deletion request submitted.',
    deleteFailed:
      locale === 'id' ? 'Gagal menghapus akun.' : 'Failed to delete account.',
    exportSuccess:
      locale === 'id'
        ? 'Permintaan export diterima. Kami akan mengirim email.'
        : 'Export request received. We will email you.',
    exportFailed:
      locale === 'id'
        ? 'Export belum tersedia. Silakan coba lagi nanti.'
        : 'Export is not available yet. Please try again later.',
    signOut: locale === 'id' ? 'Keluar' : 'Sign out',
  };

  useEffect(() => {
    setSavedAccounts(user ? saveAccountSnapshot(user) : readSavedAccounts());
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refreshSavedAccounts = () => setSavedAccounts(readSavedAccounts());
    window.addEventListener('lajukan:saved-accounts', refreshSavedAccounts);

    return () => {
      window.removeEventListener(
        'lajukan:saved-accounts',
        refreshSavedAccounts,
      );
    };
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsState('loading');
    setSessionsMessage(null);

    try {
      const res = await authFetch('/api/user/sessions', { method: 'GET' });
      const body = await res.json().catch(() => ({}) as { sessions?: unknown });
      if (!res.ok || !Array.isArray(body.sessions)) {
        throw new Error(text.sessionsFailed);
      }

      setSessions(body.sessions as UserSession[]);
      setSessionsState('success');
    } catch (error) {
      setSessionsState('error');
      setSessionsMessage(
        error instanceof Error ? error.message : text.sessionsFailed,
      );
    }
  }, [authFetch, text.sessionsFailed]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleSwitchAccount = async (account: SavedAccount) => {
    if (account.id === user?.id) return;

    const approved = await confirm({
      title: text.switchConfirmTitle,
      description: text.switchConfirmDesc,
      confirmLabel: text.switchAccount,
      cancelLabel: locale === 'id' ? 'Batal' : 'Cancel',
      tone: 'default',
    });
    if (!approved) return;

    await logout({
      redirectTo: `/${locale}/login?accountId=${encodeURIComponent(account.id)}`,
    });
  };

  const handleAddAnotherAccount = async () => {
    const approved = await confirm({
      title: locale === 'id' ? 'Login akun lain?' : 'Sign in another account?',
      description: text.switchConfirmDesc,
      confirmLabel: text.addAnotherAccount,
      cancelLabel: locale === 'id' ? 'Batal' : 'Cancel',
      tone: 'default',
    });
    if (!approved) return;

    await logout({ redirectTo: `/${locale}/login?addAccount=1` });
  };

  const handleRemoveSavedAccount = async (account: SavedAccount) => {
    const approved = await confirm({
      title: text.removeShortcut,
      description: text.removeShortcutConfirm,
      confirmLabel: text.removeShortcut,
      cancelLabel: locale === 'id' ? 'Batal' : 'Cancel',
      tone: 'danger',
    });
    if (!approved) return;

    setSavedAccounts(removeSavedAccount(account.id));
  };

  const handleRevokeSession = async (sessionId: string) => {
    setSessionActionId(sessionId);
    setSessionsMessage(null);

    try {
      const res = await authFetch(
        `/api/user/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'DELETE',
        },
      );
      const body = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        throw new Error(body?.error || text.revokeFailed);
      }
      setSessionsMessage(text.sessionRevoked);
      await loadSessions();
    } catch (error) {
      setSessionsMessage(
        error instanceof Error ? error.message : text.revokeFailed,
      );
    } finally {
      setSessionActionId(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    const approved = await confirm({
      title: text.revokeOtherDevices,
      description: text.logoutOtherConfirm,
      confirmLabel: text.revokeOtherDevices,
      cancelLabel: locale === 'id' ? 'Batal' : 'Cancel',
      tone: 'danger',
    });
    if (!approved) return;

    setSessionActionId('all');
    setSessionsMessage(null);

    try {
      const res = await authFetch('/api/user/sessions', { method: 'DELETE' });
      const body = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        throw new Error(body?.error || text.revokeFailed);
      }
      setSessionsMessage(text.sessionsUpdated);
      await loadSessions();
    } catch (error) {
      setSessionsMessage(
        error instanceof Error ? error.message : text.revokeFailed,
      );
    } finally {
      setSessionActionId(null);
    }
  };

  const handleExport = async () => {
    setExportState('loading');
    setExportMessage(null);

    try {
      const res = await fetch('/api/user/export-data', { method: 'GET' });
      if (!res.ok) {
        throw new Error(text.exportFailed);
      }
      setExportState('success');
      setExportMessage(text.exportSuccess);
    } catch (error) {
      setExportState('error');
      setExportMessage(
        error instanceof Error ? error.message : text.exportFailed,
      );
    }
  };

  const handlePasswordSave = async () => {
    const passwordError = mapPasswordPolicyError(
      validatePasswordStrength(newPassword),
      locale,
    );
    if (passwordError) {
      setPasswordState('error');
      setPasswordMessage(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordState('error');
      setPasswordMessage(text.passwordMismatch);
      return;
    }
    if (user?.hasPassword && !currentPassword.trim()) {
      setPasswordState('error');
      setPasswordMessage(
        locale === 'id'
          ? 'Masukkan password sekarang dulu.'
          : 'Enter the current password first.',
      );
      return;
    }

    setPasswordState('loading');
    setPasswordMessage(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(currentPassword.trim()
            ? { currentPassword: currentPassword.trim() }
            : {}),
          newPassword,
        }),
      });
      const body = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        throw new Error(mapCommonAuthError(body?.error, res.status));
      }

      setPasswordState('success');
      setPasswordMessage(text.passwordSuccess);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshUser();
    } catch (error) {
      setPasswordState('error');
      setPasswordMessage(
        error instanceof Error ? error.message : text.passwordFailed,
      );
    }
  };

  const handleDelete = async () => {
    if (!user?.hasPassword) {
      setDeleteState('error');
      setDeleteMessage(text.deleteSetupFirst);
      return;
    }
    if (!deletePassword) {
      setDeleteState('error');
      setDeleteMessage(text.deletePasswordRequired);
      return;
    }
    const approved = await confirm({
      title: locale === 'id' ? 'Hapus akun?' : 'Delete account?',
      description: text.deleteConfirm,
      confirmLabel: locale === 'id' ? 'Ya, hapus' : 'Yes, delete',
      cancelLabel: locale === 'id' ? 'Batal' : 'Cancel',
      tone: 'danger',
    });
    if (!approved) {
      return;
    }

    setDeleteState('loading');
    setDeleteMessage(null);

    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          reason: deleteReason || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        throw new Error(body?.error || text.deleteFailed);
      }
      setDeleteState('success');
      setDeleteMessage(text.deleteSuccess);
      setDeletePassword('');
      setDeleteReason('');
      await logout();
    } catch (error) {
      setDeleteState('error');
      setDeleteMessage(
        error instanceof Error ? error.message : text.deleteFailed,
      );
    }
  };

  return (
    <section className="page-shell py-4 sm:py-8">
      <div className="ui-page-stack page-rhythm">
        <div className="ui-panel ui-feed-section ui-hero-panel rounded-none border-x-0 p-5 sm:rounded-[var(--app-radius)] sm:border-x sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
            {locale === 'id' ? 'Pengaturan' : 'Settings'}
          </p>
          <h1 className="mt-2 text-2xl font-[1000] tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
            {text.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {text.subtitle}
          </p>
        </div>

        <div className="ui-page-section grid gap-3 sm:gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-3 sm:space-y-5">
            <div className="ui-panel ui-feed-section rounded-none border-x-0 p-5 sm:rounded-[var(--app-radius)] sm:border-x">
              <SectionHeader
                title={text.appearance}
                description={text.appearanceDesc}
              />
              <div className="mt-4 space-y-3">
                <SettingRow
                  label={text.themeMode}
                  description={text.themeModeDesc}
                >
                  <select
                    value={colorScheme}
                    onChange={event =>
                      setColorScheme(event.target.value as typeof colorScheme)
                    }
                    className={SETTINGS_SELECT_CLASS}
                  >
                    <option value="system">
                      {locale === 'id' ? 'Otomatis' : 'System'}
                    </option>
                    <option value="light">
                      {locale === 'id' ? 'Terang' : 'Light'}
                    </option>
                    <option value="dark">
                      {locale === 'id' ? 'Gelap' : 'Dark'}
                    </option>
                  </select>
                </SettingRow>
                <SettingRow
                  label={text.themePreset}
                  description={text.themePresetDesc}
                >
                  <select
                    value={themePreset}
                    onChange={event =>
                      setThemePreset(event.target.value as typeof themePreset)
                    }
                    className={SETTINGS_SELECT_CLASS}
                  >
                    <option value="default">Lajukan</option>
                    <option value="mono">
                      {locale === 'id' ? 'Mono' : 'Mono'}
                    </option>
                    <option value="ocean">
                      {locale === 'id' ? 'Ocean' : 'Ocean'}
                    </option>
                    <option value="sunset">
                      {locale === 'id' ? 'Sunset' : 'Sunset'}
                    </option>
                    <option value="orchid">
                      {locale === 'id' ? 'Orchid' : 'Orchid'}
                    </option>
                  </select>
                </SettingRow>
                <SettingRow
                  label={text.colorVision}
                  description={text.colorVisionDesc}
                >
                  <select
                    value={colorVision}
                    onChange={event =>
                      setColorVision(event.target.value as typeof colorVision)
                    }
                    className={SETTINGS_SELECT_CLASS}
                  >
                    <option value="none">
                      {locale === 'id' ? 'Normal' : 'Normal'}
                    </option>
                    <option value="high-contrast">
                      {locale === 'id' ? 'Kontras Tinggi' : 'High Contrast'}
                    </option>
                    <option value="colorblind">
                      {locale === 'id' ? 'Colorblind' : 'Colorblind'}
                    </option>
                  </select>
                </SettingRow>
                <SettingRow label={text.density} description={text.densityDesc}>
                  <select
                    value={density}
                    onChange={event =>
                      setDensity(event.target.value as typeof density)
                    }
                    className={SETTINGS_SELECT_CLASS}
                  >
                    <option value="compact">
                      {locale === 'id' ? 'Ringkas' : 'Compact'}
                    </option>
                    <option value="comfortable">
                      {locale === 'id' ? 'Lega' : 'Comfortable'}
                    </option>
                  </select>
                </SettingRow>
              </div>
            </div>

            <div className="ui-panel ui-feed-section rounded-none border-x-0 p-5 sm:rounded-[var(--app-radius)] sm:border-x">
              <SectionHeader
                title={text.typography}
                description={text.typographyDesc}
              />
              <div className="mt-4 space-y-3">
                <SettingRow label={text.fontSize}>
                  <select
                    value={fontSize}
                    onChange={event =>
                      setFontSize(event.target.value as typeof fontSize)
                    }
                    className={SETTINGS_SELECT_CLASS}
                  >
                    <option value="sm">
                      {locale === 'id' ? 'Kecil' : 'Small'}
                    </option>
                    <option value="md">
                      {locale === 'id' ? 'Sedang' : 'Medium'}
                    </option>
                    <option value="lg">
                      {locale === 'id' ? 'Besar' : 'Large'}
                    </option>
                  </select>
                </SettingRow>
                <SettingRow label={text.fontFamily}>
                  <select
                    value={fontFamily}
                    onChange={event =>
                      setFontFamily(event.target.value as typeof fontFamily)
                    }
                    className={SETTINGS_SELECT_CLASS}
                  >
                    <option value="inter">Inter</option>
                    <option value="system">
                      {locale === 'id' ? 'System' : 'System'}
                    </option>
                    <option value="georgia">Georgia</option>
                  </select>
                </SettingRow>
              </div>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-5">
            <div className="ui-panel ui-feed-section rounded-none border-x-0 p-5 sm:rounded-[var(--app-radius)] sm:border-x">
              <SectionHeader
                title={text.accessibility}
                description={text.accessibilityDesc}
              />
              <div className="mt-4 space-y-3">
                <SettingRow
                  label={text.reduceMotion}
                  description={text.reduceMotionDesc}
                >
                  <Toggle
                    id="reduce-motion"
                    checked={reduceMotion}
                    onChange={setReduceMotion}
                  />
                </SettingRow>
              </div>
            </div>

            <SocialDistributionSettings locale={locale} />

            <div className="ui-panel ui-feed-section rounded-none border-x-0 p-5 sm:rounded-[var(--app-radius)] sm:border-x">
              <SectionHeader
                title={text.account}
                description={text.accountDesc}
              />
              <div className="mt-4 grid gap-4">
                <div className="ui-panel-muted ui-feed-tile p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <Users className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {text.savedAccounts}
                        </p>
                        <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-0.5 text-[10px] font-black text-[color:var(--app-text-soft)]">
                          {savedAccounts.length}/{MAX_SAVED_ACCOUNTS}{' '}
                          {text.savedAccountLimit}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {text.savedAccountsDesc}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-[14px] border border-[color:color-mix(in_srgb,_var(--app-accent-border)_45%,_var(--app-border))] bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_55%,_var(--app-surface))] px-3 py-2 text-xs font-medium text-[color:var(--app-text)]">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                      {text.savedAccountsSecure}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {savedAccounts.length > 0 ? (
                      savedAccounts.map(account => {
                        const isCurrent = account.id === user?.id;

                        return (
                          <div
                            key={account.id}
                            className="grid gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-sm font-black text-[color:var(--app-text-inverse)]">
                                {getAccountInitial(account.displayName)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[color:var(--app-text)]">
                                  {account.displayName}
                                </p>
                                <p className="truncate text-xs text-[color:var(--app-text-soft)]">
                                  {formatSavedAccountIdentifier(account)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              {isCurrent ? (
                                <span className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-black text-[color:var(--app-accent)]">
                                  <UserRound className="h-3.5 w-3.5" />
                                  {text.currentAccount}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSwitchAccount(account)}
                                  className="ui-button-secondary min-h-[34px] px-3 text-xs font-semibold"
                                >
                                  {text.switchAccount}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveSavedAccount(account)
                                }
                                className="inline-flex min-h-[34px] items-center justify-center rounded-full border border-[color:var(--app-border)] px-3 text-xs font-semibold text-[color:var(--app-danger)] transition hover:bg-[color:var(--app-danger-soft)]"
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                {text.removeShortcut}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="rounded-[14px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                        {text.noSavedAccounts}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddAnotherAccount}
                    className="ui-button-secondary mt-3 w-full px-4 text-xs font-semibold"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    {text.addAnotherAccount}
                  </button>
                </div>

                <div className="ui-panel-muted ui-feed-tile p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-surface)] text-[color:var(--app-accent)]">
                      <Laptop className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {text.sessionsTitle}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {text.sessionsDesc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadSessions()}
                      disabled={sessionsState === 'loading'}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={text.refreshSessions}
                    >
                      <RefreshCcw
                        className={`h-4 w-4 ${
                          sessionsState === 'loading' ? 'animate-spin' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {sessions.length > 0 ? (
                      sessions.map(session => (
                        <div
                          key={session.id}
                          className="grid gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-[color:var(--app-text)]">
                                {session.deviceName ||
                                  session.deviceType ||
                                  (locale === 'id' ? 'Perangkat' : 'Device')}
                              </p>
                              {session.isCurrent ? (
                                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-black text-[color:var(--app-accent)]">
                                  {text.currentDevice}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-xs text-[color:var(--app-text-soft)]">
                              {session.location || 'Unknown'} -{' '}
                              {formatSessionTime(
                                session.lastActiveAt || session.createdAt,
                                locale,
                              )}
                            </p>
                          </div>
                          {!session.isCurrent ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleRevokeSession(session.id)
                              }
                              disabled={sessionActionId === session.id}
                              className="ui-button-secondary min-h-[34px] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {sessionActionId === session.id
                                ? '...'
                                : text.revokeSession}
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="rounded-[14px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                        {sessionsState === 'loading'
                          ? `${text.refreshSessions}...`
                          : text.sessionsEmpty}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleRevokeOtherSessions()}
                    disabled={sessionActionId === 'all'}
                    className="ui-button-secondary mt-3 w-full px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <LogOut className="mr-1.5 h-4 w-4" />
                    {sessionActionId === 'all'
                      ? '...'
                      : text.revokeOtherDevices}
                  </button>
                  {sessionsMessage ? (
                    <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                      {sessionsMessage}
                    </p>
                  ) : null}
                </div>

                <div className="ui-panel-muted ui-feed-tile p-4">
                  <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {text.passwordCard}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                    {text.passwordDesc}
                  </p>
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={event => setCurrentPassword(event.target.value)}
                      placeholder={
                        user?.hasPassword
                          ? text.currentPassword
                          : text.currentPasswordHint
                      }
                      className={SETTINGS_CONTROL_CLASS}
                      disabled={!user?.hasPassword}
                      aria-label={text.currentPassword}
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={event => setNewPassword(event.target.value)}
                      placeholder={text.newPassword}
                      className={SETTINGS_CONTROL_CLASS}
                      aria-label={text.newPassword}
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      placeholder={text.confirmPassword}
                      className={SETTINGS_CONTROL_CLASS}
                      aria-label={text.confirmPassword}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordSave}
                    disabled={passwordState === 'loading'}
                    className="ui-button-secondary mt-3 px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {passwordState === 'loading'
                      ? '...'
                      : user?.hasPassword
                        ? text.changePassword
                        : text.createPassword}
                  </button>
                  {passwordMessage ? (
                    <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                      {passwordMessage}
                    </p>
                  ) : null}
                </div>

                <div className="ui-panel-muted ui-feed-tile p-4">
                  <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {text.exportData}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                    {text.exportDesc}
                  </p>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exportState === 'loading'}
                    className="ui-button-secondary mt-3 px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {exportState === 'loading' ? '...' : text.exportCta}
                  </button>
                  {exportMessage ? (
                    <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                      {exportMessage}
                    </p>
                  ) : null}
                </div>

                <div className="ui-panel-muted ui-feed-tile p-4">
                  <p className="text-sm font-semibold text-[color:var(--app-danger)]">
                    {text.deleteAccount}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                    {text.deleteDesc}
                  </p>
                  {!user?.hasPassword ? (
                    <p className="mt-2 text-xs text-[color:var(--app-warning)]">
                      {text.deleteSetupFirst}
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={event => setDeletePassword(event.target.value)}
                      placeholder={text.deletePassword}
                      className={SETTINGS_CONTROL_CLASS}
                      disabled={!user?.hasPassword}
                      aria-label={text.deletePassword}
                    />
                    <textarea
                      value={deleteReason}
                      onChange={event => setDeleteReason(event.target.value)}
                      placeholder={text.deleteReason}
                      rows={3}
                      className={SETTINGS_TEXTAREA_CLASS}
                      disabled={!user?.hasPassword}
                      aria-label={text.deleteReason}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteState === 'loading' || !user?.hasPassword}
                    className="ui-button-danger mt-3 px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deleteState === 'loading' ? '...' : text.deleteCta}
                  </button>
                  {deleteMessage ? (
                    <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                      {deleteMessage}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="ui-button-secondary w-full px-4 text-xs font-semibold sm:w-auto"
                >
                  {text.signOut}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
