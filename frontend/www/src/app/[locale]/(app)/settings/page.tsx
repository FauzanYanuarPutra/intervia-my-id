'use client';

import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
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
import { profileAvatarSrc } from '@/lib/profile/avatar';
import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  ChevronRight,
  Database,
  Download,
  Eye,
  Globe2,
  Laptop,
  LockKeyhole,
  LogOut,
  Megaphone,
  MessageCircle,
  Moon,
  Palette,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Store,
  Trash2,
  UserCog,
  UserRound,
  Users,
  WalletCards,
  Zap,
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

type SettingsCategoryKey =
  | 'ringkas'
  | 'akun'
  | 'bisnis'
  | 'notifikasi'
  | 'privasi'
  | 'tampilan'
  | 'keamanan'
  | 'data';

type SettingsIcon = ComponentType<{ className?: string }>;

type LocalPreferenceKey =
  | 'businessProfileOpen'
  | 'acceptChat'
  | 'escrowRequired'
  | 'autoInvoice'
  | 'orderAlerts'
  | 'chatAlerts'
  | 'weeklyReport'
  | 'promoTips'
  | 'profileVisible'
  | 'showPhone'
  | 'showLocation'
  | 'allowSearchIndex'
  | 'communityMentions'
  | 'whatsappNotify'
  | 'emailNotify';

type LocalPreferences = Record<LocalPreferenceKey, boolean>;

const DEFAULT_LOCAL_PREFERENCES: LocalPreferences = {
  businessProfileOpen: true,
  acceptChat: true,
  escrowRequired: true,
  autoInvoice: true,
  orderAlerts: true,
  chatAlerts: true,
  weeklyReport: true,
  promoTips: false,
  profileVisible: true,
  showPhone: false,
  showLocation: true,
  allowSearchIndex: true,
  communityMentions: true,
  whatsappNotify: true,
  emailNotify: true,
};

const LOCAL_PREFERENCES_STORAGE_KEY = 'lajukan.settings.preferences.v1';

function readLocalPreferences(): LocalPreferences {
  if (typeof window === 'undefined') return DEFAULT_LOCAL_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFERENCES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return DEFAULT_LOCAL_PREFERENCES;
    }

    const next = { ...DEFAULT_LOCAL_PREFERENCES };
    for (const key of Object.keys(next) as LocalPreferenceKey[]) {
      if (typeof parsed[key] === 'boolean') {
        next[key] = parsed[key];
      }
    }
    return next;
  } catch {
    return DEFAULT_LOCAL_PREFERENCES;
  }
}

function detectLocale(pathname: string): 'id' | 'en' {
  return pathname.startsWith('/id') ? 'id' : 'en';
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
  'min-h-[40px] w-full rounded-[12px] border border-slate-300 bg-white px-3 text-[13px] font-semibold text-[color:var(--app-text)] shadow-none outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[color:var(--app-accent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--app-accent)_14%,transparent)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-emerald-400 dark:disabled:border-slate-800 dark:disabled:bg-slate-900/70';
const SETTINGS_SELECT_CLASS = `${SETTINGS_CONTROL_CLASS} appearance-none pr-9`;
const SETTINGS_TEXTAREA_CLASS = `${SETTINGS_CONTROL_CLASS} min-h-[84px] resize-y py-2.5 leading-5`;

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

function SettingsPanel({
  id,
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  icon: SettingsIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.24)] dark:border-[color:var(--app-border-strong)] sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-black leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  children,
  danger = false,
}: {
  icon: SettingsIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2.5 dark:border-[color:var(--app-border-strong)]">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[12px] ${
          danger
            ? 'bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]'
            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-black ${
            danger
              ? 'text-[color:var(--app-danger)]'
              : 'text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]'
          }`}
        >
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block line-clamp-2 text-xs font-semibold leading-4 text-[color:var(--app-text-soft)]">
            {description}
          </span>
        ) : null}
      </span>
      {children ? <span className="shrink-0">{children}</span> : null}
    </div>
  );
}

function QuickLinkCard({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: SettingsIcon;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-3 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] dark:border-[color:var(--app-border-strong)]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)] transition group-hover:bg-white">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
          {description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--app-accent)]" />
    </Link>
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
  const isId = locale === 'id';
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
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategoryKey>('ringkas');
  const [localPreferences, setLocalPreferences] =
    useState<LocalPreferences>(readLocalPreferences);

  const updateLocalPreference = useCallback(
    (key: LocalPreferenceKey, value: boolean) => {
      setLocalPreferences(prev => ({ ...prev, [key]: value }));
    },
    [],
  );

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

  const categories = useMemo(
    () =>
      [
        {
          key: 'ringkas',
          label: isId ? 'Ringkas' : 'Overview',
          description: isId ? 'Yang sering dipakai' : 'Frequently used',
          icon: SlidersHorizontal,
        },
        {
          key: 'akun',
          label: isId ? 'Akun' : 'Account',
          description: isId
            ? 'Profil & akun tersimpan'
            : 'Profile and saved accounts',
          icon: UserCog,
        },
        {
          key: 'bisnis',
          label: isId ? 'Bisnis' : 'Business',
          description: isId ? 'Toko, chat, transaksi' : 'Store, chat, deals',
          icon: BriefcaseBusiness,
        },
        {
          key: 'notifikasi',
          label: isId ? 'Notifikasi' : 'Notifications',
          description: isId ? 'Chat, order, laporan' : 'Chat, orders, reports',
          icon: BellRing,
        },
        {
          key: 'privasi',
          label: isId ? 'Privasi' : 'Privacy',
          description: isId
            ? 'Nomor, lokasi, pencarian'
            : 'Phone, location, search',
          icon: Eye,
        },
        {
          key: 'tampilan',
          label: isId ? 'Tampilan' : 'Display',
          description: isId
            ? 'Tema, font, aksesibilitas'
            : 'Theme, font, accessibility',
          icon: Palette,
        },
        {
          key: 'keamanan',
          label: isId ? 'Keamanan' : 'Security',
          description: isId ? 'Password & perangkat' : 'Password and devices',
          icon: LockKeyhole,
        },
        {
          key: 'data',
          label: isId ? 'Data' : 'Data',
          description: isId ? 'Export & hapus akun' : 'Export and deletion',
          icon: Database,
        },
      ] satisfies Array<{
        key: SettingsCategoryKey;
        label: string;
        description: string;
        icon: SettingsIcon;
      }>,
    [isId],
  );

  const quickLinks = useMemo(
    () => [
      {
        href: '/profile/edit',
        icon: UserCog,
        label: isId ? 'Edit profil' : 'Edit profile',
        description: isId
          ? 'Nama, foto, bio, kontak'
          : 'Name, photo, bio, contact',
      },
      {
        href: '/usaha',
        icon: Store,
        label: isId ? 'Kelola usaha' : 'Manage business',
        description: isId ? 'Toko, katalog, order' : 'Store, catalog, orders',
      },
      {
        href: '/payments',
        icon: WalletCards,
        label: isId ? 'Saldo & pembayaran' : 'Balance and payments',
        description: isId
          ? 'Wallet, invoice, payout'
          : 'Wallet, invoices, payouts',
      },
      {
        href: '/notifications',
        icon: BellRing,
        label: isId ? 'Pusat notifikasi' : 'Notification center',
        description: isId ? 'Inbox semua update' : 'Inbox for all updates',
      },
    ],
    [isId],
  );

  useEffect(() => {
    setSavedAccounts(user ? saveAccountSnapshot(user) : readSavedAccounts());
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        LOCAL_PREFERENCES_STORAGE_KEY,
        JSON.stringify(localPreferences),
      );
    } catch {
      // Preference persistence is best-effort on this device.
    }
  }, [localPreferences]);

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
    <section className="min-h-screen bg-[color:var(--app-surface-muted)] px-2 py-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] dark:bg-[color:var(--app-surface)] sm:px-4 sm:py-5 lg:pb-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.28)] dark:border-[color:var(--app-border-strong)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[18px] bg-[color:var(--app-surface-muted)] ring-1 ring-[color:var(--app-border)]">
                <Image
                  src={profileAvatarSrc(user?.avatarUrl || user?.avatar_url)}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                  {isId ? 'Pusat pengaturan' : 'Settings center'}
                </p>
                <h1 className="mt-0.5 truncate text-[1.45rem] font-black leading-tight tracking-[-0.025em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
                  {text.title}
                </h1>
                <p className="mt-1 line-clamp-2 max-w-2xl text-xs font-semibold leading-5 text-[color:var(--app-text-soft)] sm:text-sm">
                  {isId
                    ? 'Atur akun, usaha, notifikasi, privasi, tampilan, dan keamanan dari satu tempat.'
                    : 'Manage account, business, notifications, privacy, display, and security in one place.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 lg:w-[360px]">
              {[
                {
                  label: isId ? 'Akun' : 'Account',
                  value: user?.hasPassword
                    ? isId
                      ? 'Aman'
                      : 'Secure'
                    : isId
                      ? 'OTP'
                      : 'OTP',
                },
                {
                  label: isId ? 'Sesi' : 'Sessions',
                  value:
                    sessionsState === 'loading'
                      ? '...'
                      : String(Math.max(1, sessions.length || 1)),
                },
                {
                  label: isId ? 'Channel' : 'Channels',
                  value: isId ? 'Siap' : 'Ready',
                },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2.5 py-2 text-center dark:border-[color:var(--app-border-strong)]"
                >
                  <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {item.value}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="mt-3 grid gap-3 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-[calc(72px+env(safe-area-inset-top))] lg:self-start">
            <div className="overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
              <div className="flex gap-1.5 lg:grid">
                {categories.map(item => {
                  const Icon = item.icon;
                  const active = activeCategory === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveCategory(item.key)}
                      className={`flex min-w-[154px] items-center gap-2 rounded-[15px] border px-3 py-2 text-left transition lg:min-w-0 ${
                        active
                          ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] shadow-sm'
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)]'
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[12px] ${
                          active
                            ? 'bg-white text-[color:var(--app-accent)]'
                            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 dark:border-[color:var(--app-border-strong)] lg:block">
              <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {isId ? 'Bantuan cepat' : 'Quick help'}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Pilih kategori. Simpan yang penting saja, sisanya bisa dibuka nanti.'
                  : 'Pick a category. Save what matters now and return later.'}
              </p>
              <Link
                href="/support"
                className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3 text-xs font-black text-[color:var(--app-text-inverse)]"
              >
                {isId ? 'Buka bantuan' : 'Open help'}
              </Link>
            </div>
          </aside>

          <main className="min-w-0 space-y-3">
            {activeCategory === 'ringkas' ? (
              <>
                <SettingsPanel
                  icon={Zap}
                  title={isId ? 'Yang sering dipakai' : 'Frequently used'}
                  description={
                    isId
                      ? 'Shortcut paling umum seperti Facebook: profil, usaha, pembayaran, dan notifikasi.'
                      : 'Common shortcuts: profile, business, payments, and notifications.'
                  }
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {quickLinks.map(item => (
                      <QuickLinkCard key={item.href} {...item} />
                    ))}
                  </div>
                </SettingsPanel>

                <SettingsPanel
                  icon={BadgeCheck}
                  title={isId ? 'Status akun kamu' : 'Your account status'}
                  description={
                    isId
                      ? 'Ringkasan ini bantu pelaku usaha tahu apa yang perlu dibereskan.'
                      : 'This summary helps business users see what needs attention.'
                  }
                >
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      {
                        icon: ShieldCheck,
                        label: isId ? 'Login' : 'Login',
                        desc: user?.hasPassword
                          ? isId
                            ? 'Password sudah dibuat'
                            : 'Password is set'
                          : isId
                            ? 'Masih mengandalkan OTP'
                            : 'Still using OTP',
                      },
                      {
                        icon: Smartphone,
                        label: isId ? 'Perangkat' : 'Devices',
                        desc:
                          sessions.length > 0
                            ? `${sessions.length} ${isId ? 'sesi tercatat' : 'recorded sessions'}`
                            : isId
                              ? 'Belum ada sesi lain'
                              : 'No other sessions',
                      },
                      {
                        icon: Store,
                        label: isId ? 'Usaha' : 'Business',
                        desc: localPreferences.businessProfileOpen
                          ? isId
                            ? 'Profil usaha aktif'
                            : 'Business profile active'
                          : isId
                            ? 'Profil usaha disembunyikan'
                            : 'Business profile hidden',
                      },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="rounded-[15px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 dark:border-[color:var(--app-border-strong)]"
                        >
                          <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <p className="mt-2 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {item.label}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                            {item.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </SettingsPanel>
              </>
            ) : null}

            {activeCategory === 'akun' ? (
              <SettingsPanel
                icon={Users}
                title={text.savedAccounts}
                description={text.savedAccountsDesc}
                action={
                  <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1 text-[10px] font-black text-[color:var(--app-text-soft)]">
                    {savedAccounts.length}/{MAX_SAVED_ACCOUNTS}
                  </span>
                }
              >
                <div className="rounded-[14px] border border-[color:color-mix(in_srgb,_var(--app-accent-border)_45%,_var(--app-border))] bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_55%,_var(--app-surface))] px-3 py-2 text-xs font-semibold text-[color:var(--app-text)]">
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
                          className="grid gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2.5 dark:border-[color:var(--app-border-strong)] sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                              <Image
                                src={profileAvatarSrc(account.avatarUrl)}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                {account.displayName}
                              </p>
                              <p className="truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
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
                              onClick={() => handleRemoveSavedAccount(account)}
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
                    <p className="rounded-[14px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-3 text-xs font-semibold text-[color:var(--app-text-soft)]">
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
              </SettingsPanel>
            ) : null}

            {activeCategory === 'bisnis' ? (
              <>
                <SettingsPanel
                  icon={BriefcaseBusiness}
                  title={isId ? 'Preferensi usaha' : 'Business preferences'}
                  description={
                    isId
                      ? 'Pengaturan yang paling sering dicari pemilik UMKM: visibilitas, chat, transaksi, dan invoice.'
                      : 'Common business controls: visibility, chat, transactions, and invoices.'
                  }
                >
                  <div className="space-y-2">
                    {[
                      {
                        key: 'businessProfileOpen' as const,
                        icon: Store,
                        title: isId
                          ? 'Profil usaha tampil di pencarian'
                          : 'Business profile appears in search',
                        desc: isId
                          ? 'Buyer bisa menemukan toko, jasa, dan katalog kamu.'
                          : 'Buyers can find your store, services, and catalog.',
                      },
                      {
                        key: 'acceptChat' as const,
                        icon: MessageCircle,
                        title: isId
                          ? 'Terima chat calon pembeli'
                          : 'Accept buyer chats',
                        desc: isId
                          ? 'Chat masuk dari listing, toko, dan profil publik.'
                          : 'Chats can come from listings, stores, and public profile.',
                      },
                      {
                        key: 'escrowRequired' as const,
                        icon: ShieldCheck,
                        title: isId
                          ? 'Sarankan pembayaran aman'
                          : 'Recommend protected payments',
                        desc: isId
                          ? 'Tampilkan opsi escrow saat transaksi jasa atau project.'
                          : 'Show escrow options for services and projects.',
                      },
                      {
                        key: 'autoInvoice' as const,
                        icon: WalletCards,
                        title: isId
                          ? 'Buat invoice otomatis'
                          : 'Auto-create invoices',
                        desc: isId
                          ? 'Invoice disiapkan setelah deal di chat.'
                          : 'Invoices are prepared after a chat deal.',
                      },
                    ].map(item => (
                      <PreferenceRow
                        key={item.key}
                        icon={item.icon}
                        title={item.title}
                        description={item.desc}
                      >
                        <Toggle
                          id={`business-${item.key}`}
                          checked={localPreferences[item.key]}
                          onChange={value =>
                            updateLocalPreference(item.key, value)
                          }
                        />
                      </PreferenceRow>
                    ))}
                  </div>
                </SettingsPanel>
                <SocialDistributionSettings locale={locale} />
              </>
            ) : null}

            {activeCategory === 'notifikasi' ? (
              <SettingsPanel
                icon={BellRing}
                title={isId ? 'Notifikasi' : 'Notifications'}
                description={
                  isId
                    ? 'Dibuat seperti aplikasi yang familiar: cukup pilih update apa yang penting.'
                    : 'Pick the updates that matter most.'
                }
              >
                <div className="space-y-2">
                  {[
                    {
                      key: 'orderAlerts' as const,
                      icon: WalletCards,
                      title: isId
                        ? 'Order dan pembayaran'
                        : 'Orders and payments',
                      desc: isId
                        ? 'Top up, invoice, escrow, payout, refund.'
                        : 'Top ups, invoices, escrow, payouts, refunds.',
                    },
                    {
                      key: 'chatAlerts' as const,
                      icon: MessageCircle,
                      title: isId ? 'Chat dan penawaran' : 'Chats and offers',
                      desc: isId
                        ? 'Pesan buyer, negosiasi, dan follow up.'
                        : 'Buyer messages, negotiation, and follow ups.',
                    },
                    {
                      key: 'weeklyReport' as const,
                      icon: Download,
                      title: isId ? 'Ringkasan mingguan' : 'Weekly summary',
                      desc: isId
                        ? 'Performa listing, toko, dan transaksi.'
                        : 'Listing, store, and transaction performance.',
                    },
                    {
                      key: 'promoTips' as const,
                      icon: Megaphone,
                      title: isId
                        ? 'Tips promo dan edukasi'
                        : 'Promotion tips and learning',
                      desc: isId
                        ? 'Ide konten, campaign, dan peluang usaha.'
                        : 'Content ideas, campaigns, and business opportunities.',
                    },
                  ].map(item => (
                    <PreferenceRow
                      key={item.key}
                      icon={item.icon}
                      title={item.title}
                      description={item.desc}
                    >
                      <Toggle
                        id={`notify-${item.key}`}
                        checked={localPreferences[item.key]}
                        onChange={value =>
                          updateLocalPreference(item.key, value)
                        }
                      />
                    </PreferenceRow>
                  ))}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <PreferenceRow
                    icon={Smartphone}
                    title="WhatsApp"
                    description={
                      isId
                        ? 'Untuk update penting transaksi dan chat.'
                        : 'For important transaction and chat updates.'
                    }
                  >
                    <Toggle
                      id="channel-whatsapp"
                      checked={localPreferences.whatsappNotify}
                      onChange={value =>
                        updateLocalPreference('whatsappNotify', value)
                      }
                    />
                  </PreferenceRow>
                  <PreferenceRow
                    icon={Globe2}
                    title="Email"
                    description={
                      isId
                        ? 'Untuk laporan dan dokumen akun.'
                        : 'For reports and account documents.'
                    }
                  >
                    <Toggle
                      id="channel-email"
                      checked={localPreferences.emailNotify}
                      onChange={value =>
                        updateLocalPreference('emailNotify', value)
                      }
                    />
                  </PreferenceRow>
                </div>
              </SettingsPanel>
            ) : null}

            {activeCategory === 'privasi' ? (
              <SettingsPanel
                icon={Eye}
                title={
                  isId ? 'Privasi dan visibilitas' : 'Privacy and visibility'
                }
                description={
                  isId
                    ? 'Kontrol apa yang terlihat oleh buyer, komunitas, dan mesin pencari Lajukan.'
                    : 'Control what buyers, community members, and Lajukan search can see.'
                }
              >
                <div className="space-y-2">
                  {[
                    {
                      key: 'profileVisible' as const,
                      icon: Eye,
                      title: isId
                        ? 'Profil publik aktif'
                        : 'Public profile active',
                      desc: isId
                        ? 'Orang bisa melihat profil dan etalase kamu.'
                        : 'People can view your profile and showcase.',
                    },
                    {
                      key: 'showPhone' as const,
                      icon: Smartphone,
                      title: isId ? 'Tampilkan nomor HP' : 'Show phone number',
                      desc: isId
                        ? 'Nomor hanya ditampilkan kalau kamu izinkan.'
                        : 'Your number is shown only when allowed.',
                    },
                    {
                      key: 'showLocation' as const,
                      icon: Globe2,
                      title: isId
                        ? 'Tampilkan lokasi usaha'
                        : 'Show business location',
                      desc: isId
                        ? 'Bantu buyer lokal menemukan usaha kamu.'
                        : 'Help local buyers find your business.',
                    },
                    {
                      key: 'allowSearchIndex' as const,
                      icon: Search,
                      title: isId
                        ? 'Muncul di pencarian Lajukan'
                        : 'Appear in Lajukan search',
                      desc: isId
                        ? 'Produk, jasa, dan profil bisa muncul di hasil cari.'
                        : 'Products, services, and profile can appear in search.',
                    },
                    {
                      key: 'communityMentions' as const,
                      icon: MessageCircle,
                      title: isId
                        ? 'Izinkan mention komunitas'
                        : 'Allow community mentions',
                      desc: isId
                        ? 'Member bisa mention akun kamu di diskusi.'
                        : 'Members can mention your account in discussions.',
                    },
                  ].map(item => (
                    <PreferenceRow
                      key={item.key}
                      icon={item.icon}
                      title={item.title}
                      description={item.desc}
                    >
                      <Toggle
                        id={`privacy-${item.key}`}
                        checked={localPreferences[item.key]}
                        onChange={value =>
                          updateLocalPreference(item.key, value)
                        }
                      />
                    </PreferenceRow>
                  ))}
                </div>
              </SettingsPanel>
            ) : null}

            {activeCategory === 'tampilan' ? (
              <div className="space-y-3">
                <SettingsPanel
                  icon={Palette}
                  title={text.appearance}
                  description={text.appearanceDesc}
                >
                  <div className="space-y-2">
                    <SettingRow
                      label={text.themeMode}
                      description={text.themeModeDesc}
                    >
                      <select
                        value={colorScheme}
                        onChange={event =>
                          setColorScheme(
                            event.target.value as typeof colorScheme,
                          )
                        }
                        className={SETTINGS_SELECT_CLASS}
                      >
                        <option value="system">
                          {isId ? 'Otomatis' : 'System'}
                        </option>
                        <option value="light">
                          {isId ? 'Terang' : 'Light'}
                        </option>
                        <option value="dark">{isId ? 'Gelap' : 'Dark'}</option>
                      </select>
                    </SettingRow>
                    <SettingRow
                      label={text.themePreset}
                      description={text.themePresetDesc}
                    >
                      <select
                        value={themePreset}
                        onChange={event =>
                          setThemePreset(
                            event.target.value as typeof themePreset,
                          )
                        }
                        className={SETTINGS_SELECT_CLASS}
                      >
                        <option value="default">Lajukan</option>
                        <option value="mono">Mono</option>
                        <option value="ocean">Ocean</option>
                        <option value="sunset">Sunset</option>
                        <option value="orchid">Orchid</option>
                      </select>
                    </SettingRow>
                    <SettingRow
                      label={text.colorVision}
                      description={text.colorVisionDesc}
                    >
                      <select
                        value={colorVision}
                        onChange={event =>
                          setColorVision(
                            event.target.value as typeof colorVision,
                          )
                        }
                        className={SETTINGS_SELECT_CLASS}
                      >
                        <option value="none">Normal</option>
                        <option value="high-contrast">
                          {isId ? 'Kontras Tinggi' : 'High Contrast'}
                        </option>
                        <option value="colorblind">Colorblind</option>
                      </select>
                    </SettingRow>
                  </div>
                </SettingsPanel>

                <SettingsPanel
                  icon={Moon}
                  title={text.typography}
                  description={text.typographyDesc}
                >
                  <div className="space-y-2">
                    <SettingRow
                      label={text.density}
                      description={text.densityDesc}
                    >
                      <select
                        value={density}
                        onChange={event =>
                          setDensity(event.target.value as typeof density)
                        }
                        className={SETTINGS_SELECT_CLASS}
                      >
                        <option value="compact">
                          {isId ? 'Ringkas' : 'Compact'}
                        </option>
                        <option value="comfortable">
                          {isId ? 'Lega' : 'Comfortable'}
                        </option>
                      </select>
                    </SettingRow>
                    <SettingRow label={text.fontSize}>
                      <select
                        value={fontSize}
                        onChange={event =>
                          setFontSize(event.target.value as typeof fontSize)
                        }
                        className={SETTINGS_SELECT_CLASS}
                      >
                        <option value="sm">{isId ? 'Kecil' : 'Small'}</option>
                        <option value="md">{isId ? 'Sedang' : 'Medium'}</option>
                        <option value="lg">{isId ? 'Besar' : 'Large'}</option>
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
                        <option value="system">System</option>
                        <option value="georgia">Georgia</option>
                      </select>
                    </SettingRow>
                    <PreferenceRow
                      icon={SlidersHorizontal}
                      title={text.reduceMotion}
                      description={text.reduceMotionDesc}
                    >
                      <Toggle
                        id="reduce-motion"
                        checked={reduceMotion}
                        onChange={setReduceMotion}
                      />
                    </PreferenceRow>
                  </div>
                </SettingsPanel>
              </div>
            ) : null}

            {activeCategory === 'keamanan' ? (
              <div className="space-y-3">
                <SettingsPanel
                  icon={Laptop}
                  title={text.sessionsTitle}
                  description={text.sessionsDesc}
                  action={
                    <button
                      type="button"
                      onClick={() => void loadSessions()}
                      disabled={sessionsState === 'loading'}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-accent)] disabled:opacity-60"
                      aria-label={text.refreshSessions}
                    >
                      <RefreshCcw
                        className={`h-4 w-4 ${
                          sessionsState === 'loading' ? 'animate-spin' : ''
                        }`}
                      />
                    </button>
                  }
                >
                  <div className="space-y-2">
                    {sessions.length > 0 ? (
                      sessions.map(session => (
                        <div
                          key={session.id}
                          className="grid gap-2 rounded-[15px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 dark:border-[color:var(--app-border-strong)] sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                {session.deviceName ||
                                  session.deviceType ||
                                  (isId ? 'Perangkat' : 'Device')}
                              </p>
                              {session.isCurrent ? (
                                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-black text-[color:var(--app-accent)]">
                                  {text.currentDevice}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
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
                              className="ui-button-secondary min-h-[34px] px-3 text-xs font-semibold disabled:opacity-70"
                            >
                              {sessionActionId === session.id
                                ? '...'
                                : text.revokeSession}
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="rounded-[14px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-3 text-xs font-semibold text-[color:var(--app-text-soft)]">
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
                    className="ui-button-secondary mt-3 w-full px-4 text-xs font-semibold disabled:opacity-70"
                  >
                    <LogOut className="mr-1.5 h-4 w-4" />
                    {sessionActionId === 'all'
                      ? '...'
                      : text.revokeOtherDevices}
                  </button>
                  {sessionsMessage ? (
                    <p className="mt-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      {sessionsMessage}
                    </p>
                  ) : null}
                </SettingsPanel>

                <SettingsPanel
                  icon={LockKeyhole}
                  title={text.passwordCard}
                  description={text.passwordDesc}
                >
                  <div className="grid gap-2 sm:grid-cols-3">
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
                    className="ui-button-secondary mt-3 px-4 text-xs font-semibold disabled:opacity-70"
                  >
                    {passwordState === 'loading'
                      ? '...'
                      : user?.hasPassword
                        ? text.changePassword
                        : text.createPassword}
                  </button>
                  {passwordMessage ? (
                    <p className="mt-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      {passwordMessage}
                    </p>
                  ) : null}
                </SettingsPanel>
              </div>
            ) : null}

            {activeCategory === 'data' ? (
              <div className="space-y-3">
                <SettingsPanel
                  icon={Database}
                  title={text.exportData}
                  description={text.exportDesc}
                >
                  <PreferenceRow
                    icon={Download}
                    title={
                      isId ? 'Unduh arsip akun' : 'Download account archive'
                    }
                    description={
                      isId
                        ? 'Data profil, postingan, transaksi, dan preferensi akan disiapkan.'
                        : 'Profile, posts, transactions, and preferences will be prepared.'
                    }
                  >
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={exportState === 'loading'}
                      className="ui-button-secondary min-h-[34px] px-3 text-xs font-semibold disabled:opacity-70"
                    >
                      {exportState === 'loading' ? '...' : text.exportCta}
                    </button>
                  </PreferenceRow>
                  {exportMessage ? (
                    <p className="mt-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      {exportMessage}
                    </p>
                  ) : null}
                </SettingsPanel>

                <SettingsPanel
                  icon={AlertTriangle}
                  title={text.deleteAccount}
                  description={text.deleteDesc}
                >
                  {!user?.hasPassword ? (
                    <p className="mb-3 rounded-[14px] bg-[color:var(--app-warning-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--app-warning)]">
                      {text.deleteSetupFirst}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
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
                      className={`${SETTINGS_TEXTAREA_CLASS} sm:row-span-2`}
                      disabled={!user?.hasPassword}
                      aria-label={text.deleteReason}
                    />
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteState === 'loading' || !user?.hasPassword}
                      className="ui-button-danger px-4 text-xs font-semibold disabled:opacity-70"
                    >
                      {deleteState === 'loading' ? '...' : text.deleteCta}
                    </button>
                  </div>
                  {deleteMessage ? (
                    <p className="mt-2 text-xs font-semibold text-[color:var(--app-text-soft)]">
                      {deleteMessage}
                    </p>
                  ) : null}
                </SettingsPanel>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="ui-button-secondary w-full px-4 text-xs font-semibold sm:w-auto"
                >
                  <LogOut className="mr-1.5 h-4 w-4" />
                  {text.signOut}
                </button>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </section>
  );
}
