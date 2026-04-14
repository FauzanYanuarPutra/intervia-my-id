'use client';

import { type ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDialog } from '@/components/system/feedback/DialogProvider';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useUISettings } from '@/context/UISettingsContext';
import { mapCommonAuthError } from '@/lib/authErrors';
import { validatePasswordStrength } from '@/lib/passwordPolicy';
import { SocialDistributionSettings } from './SocialDistributionSettings';

type ActionState = 'idle' | 'loading' | 'success' | 'error';

function detectLocale(pathname: string): 'id' | 'en' {
  return pathname.startsWith('/id') ? 'id' : 'en';
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
    <div className="ui-feed-row flex flex-col gap-2 border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:var(--app-surface-muted)] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
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
  const { logout, refreshUser, user } = useAuth();
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

  const text = {
    title: locale === 'id' ? 'Pengaturan' : 'Settings',
    subtitle:
      locale === 'id'
        ? 'Sesuaikan tampilan, aksesibilitas, dan data akun dengan cepat.'
        : 'Tune appearance, accessibility, and account data quickly.',
    appearance: locale === 'id' ? 'Tampilan' : 'Appearance',
    appearanceDesc:
      locale === 'id'
        ? 'Pilih mode terang atau gelap dan preset warna brand yang paling nyaman.'
        : 'Choose light or dark mode and the brand palette that feels best.',
    typography: locale === 'id' ? 'Tipografi' : 'Typography',
    typographyDesc:
      locale === 'id'
        ? 'Atur ukuran dan jenis font untuk membaca lebih nyaman.'
        : 'Adjust font size and family for readability.',
    accessibility: locale === 'id' ? 'Aksesibilitas' : 'Accessibility',
    accessibilityDesc:
      locale === 'id'
        ? 'Pengaturan untuk mengurangi gerakan dan meningkatkan kontras.'
        : 'Controls to reduce motion and improve contrast.',
    account: locale === 'id' ? 'Akun & Data' : 'Account & Data',
    accountDesc:
      locale === 'id'
        ? 'Kelola password, export data, dan penghapusan akun.'
        : 'Manage password, data export, and account deletion.',
    passwordCard: locale === 'id' ? 'Password akun' : 'Account password',
    passwordDesc:
      locale === 'id'
        ? 'Login utama tetap pakai nomor HP + OTP. Password ini hanya dipakai kalau nanti dibutuhkan dari Settings atau alur lanjutan.'
        : 'The main login still uses phone + OTP. This password only exists for later Settings or advanced flows.',
    createPassword: locale === 'id' ? 'Buat Password' : 'Create Password',
    changePassword: locale === 'id' ? 'Ganti Password' : 'Change Password',
    currentPassword: locale === 'id' ? 'Password sekarang' : 'Current password',
    currentPasswordHint:
      locale === 'id'
        ? 'Kosongkan karena akun ini belum punya password.'
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
        ? 'Buat password dulu di atas sebelum menghapus akun.'
        : 'Create a password above before deleting the account.',
    themeMode: locale === 'id' ? 'Mode Tema' : 'Theme Mode',
    themeModeDesc:
      locale === 'id'
        ? 'Pilih otomatis, terang, atau gelap.'
        : 'Pick system, light, or dark.',
    themePreset: locale === 'id' ? 'Preset Tema' : 'Theme Preset',
    themePresetDesc:
      locale === 'id'
        ? 'Pilih palet utama: Lajukan, mono, ocean, sunset, atau orchid.'
        : 'Pick the primary palette: Lajukan, mono, ocean, sunset, or orchid.',
    colorVision: locale === 'id' ? 'Mode Warna' : 'Color Vision',
    colorVisionDesc:
      locale === 'id'
        ? 'Optimasi untuk kontras tinggi atau colorblind.'
        : 'Optimize for high contrast or colorblind.',
    density: locale === 'id' ? 'Kerapatan' : 'Density',
    densityDesc:
      locale === 'id'
        ? 'Atur jarak komponen agar ringkas atau lega.'
        : 'Choose compact or comfortable spacing.',
    fontSize: locale === 'id' ? 'Ukuran Font' : 'Font Size',
    fontFamily: locale === 'id' ? 'Keluarga Font' : 'Font Family',
    reduceMotion: locale === 'id' ? 'Kurangi Animasi' : 'Reduce Motion',
    reduceMotionDesc:
      locale === 'id'
        ? 'Matikan animasi untuk pengalaman lebih stabil.'
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
            Settings
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
                    className="ui-control w-full px-3 text-sm"
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
                    className="ui-control w-full px-3 text-sm"
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
                    className="ui-control w-full px-3 text-sm"
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
                    className="ui-control w-full px-3 text-sm"
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
                    className="ui-control w-full px-3 text-sm"
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
                    className="ui-control w-full px-3 text-sm"
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
                      className="ui-control w-full px-3 text-sm"
                      disabled={!user?.hasPassword}
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={event => setNewPassword(event.target.value)}
                      placeholder={text.newPassword}
                      className="ui-control w-full px-3 text-sm"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      placeholder={text.confirmPassword}
                      className="ui-control w-full px-3 text-sm"
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
                      className="ui-control w-full px-3 text-sm"
                      disabled={!user?.hasPassword}
                    />
                    <textarea
                      value={deleteReason}
                      onChange={event => setDeleteReason(event.target.value)}
                      placeholder={text.deleteReason}
                      rows={3}
                      className="ui-control w-full px-3 py-2 text-sm"
                      disabled={!user?.hasPassword}
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
