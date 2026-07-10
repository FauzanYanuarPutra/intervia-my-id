'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  CreditCard,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import {
  formatSavedAccountIdentifier,
  readSavedAccounts,
  removeSavedAccount,
  saveAccountSnapshot,
  type SavedAccount,
} from '@/lib/accountVault';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { buildUsahaPath } from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

type AccountDropdownVariant =
  | 'avatar-name'
  | 'avatar-role'
  | 'icon-label'
  | 'icon';

type AccountDropdownProps = {
  isId?: boolean;
  variant?: AccountDropdownVariant;
  displayName?: string;
  avatarSrc?: string;
  roleLabel?: string;
  className?: string;
  menuClassName?: string;
};

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function normalizePathname(pathname: string | null): string {
  const clean = (pathname || '/').replace(/^\/(id|en)(?=\/|$)/, '');
  return clean === '' ? '/' : clean;
}

function hrefPath(href: string): string {
  return href.split(/[?#]/)[0] || '/';
}

function matchesRoute(pathname: string, matcher: string): boolean {
  const exact = matcher.endsWith('$');
  const route = exact ? matcher.slice(0, -1) || '/' : matcher;
  if (route === '/') return pathname === '/';
  if (exact) return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function AccountDropdown({
  isId,
  variant = 'avatar-name',
  displayName,
  avatarSrc,
  roleLabel,
  className,
  menuClassName,
}: AccountDropdownProps) {
  const pathname = usePathname();
  const locale = resolveLocaleFromPathname(pathname);
  const idLocale = isId ?? locale === 'id';
  const cleanPath = normalizePathname(pathname);
  const { logout, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const name =
    displayName ||
    user?.fullName ||
    user?.full_name ||
    user?.username ||
    (idLocale ? 'Akun' : 'Account');
  const avatar = profileAvatarSrc(
    avatarSrc || user?.avatarUrl || user?.avatar_url,
    readProfileAvatarStyle(user),
    name,
  );
  const subtitle = user?.email || user?.phone || roleLabel || '-';

  const text = {
    account: idLocale ? 'Akun saya' : 'My account',
    settings: idLocale ? 'Pengaturan' : 'Settings',
    listings: idLocale ? 'Postingan' : 'Posts',
    transactions: idLocale ? 'Transaksi' : 'Transactions',
    wallet: idLocale ? 'Saldo' : 'Balance',
    usaha: idLocale ? 'Usaha saya' : 'My business',
    savedAccounts: idLocale ? 'Akun tersimpan' : 'Saved accounts',
    current: idLocale ? 'Aktif' : 'Current',
    switch: idLocale ? 'Pakai akun ini' : 'Use this account',
    add: idLocale ? 'Login akun lain' : 'Sign in another account',
    remove: idLocale ? 'Hapus shortcut' : 'Remove shortcut',
    logout: idLocale ? 'Keluar' : 'Logout',
  };

  const items: MenuItem[] = [
    { href: '/profile', label: text.account, icon: UserRound },
    { href: '/settings', label: text.settings, icon: Settings },
    { href: '/my-listings', label: text.listings, icon: ShoppingBag },
    ...(!PROMO_ONLY_MODE
      ? [
        { href: '/transactions', label: text.transactions, icon: CreditCard },
        { href: '/payments', label: text.wallet, icon: Wallet },
      ]
      : []),
    { href: buildUsahaPath('home'), label: text.usaha, icon: ShieldCheck },
  ];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSavedAccounts(user ? saveAccountSnapshot(user) : readSavedAccounts());
    }, 0);

    return () => window.clearTimeout(timeoutId);
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

  const updateMenuPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportGap = 12;
    const width = Math.min(336, window.innerWidth - viewportGap * 2);
    const left = Math.min(
      Math.max(viewportGap, rect.right - width),
      window.innerWidth - width - viewportGap,
    );

    setMenuPosition({
      left,
      top: rect.bottom + 8,
      width,
    });
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        open &&
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const switchAccount = async (account: SavedAccount) => {
    setOpen(false);
    await logout({
      redirectTo: `/${locale}/login?accountId=${encodeURIComponent(account.id)}`,
    });
  };

  const addAccount = async () => {
    setOpen(false);
    await logout({ redirectTo: `/${locale}/login?addAccount=1` });
  };

  const removeAccount = (accountId: string) => {
    setSavedAccounts(removeSavedAccount(accountId));
  };

  const buttonClass = cn(
    'relative inline-flex shrink-0 items-center border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)] shadow-[0_14px_24px_-22px_rgba(15,23,42,0.16)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus:outline-none focus:ring-4 focus:ring-[color:color-mix(in_srgb,_var(--app-accent)_14%,_transparent)] dark:bg-slate-950/70',
    variant === 'avatar-name' && 'min-h-[40px] gap-2 rounded-full px-2 pr-3',
    variant === 'avatar-role' &&
    'min-h-[42px] gap-2.5 rounded-full px-2 pr-2 xl:px-2.5 xl:pr-3',
    variant === 'icon-label' &&
    'min-h-[40px] gap-2 rounded-full px-3 text-xs font-semibold',
    variant === 'icon' && 'h-9 w-9 justify-center rounded-full',
    className,
  );

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(previous => !previous)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={text.account}
        className={buttonClass}
      >
        {variant === 'icon' ? (
          <UserRound className="h-4 w-4" />
        ) : variant === 'icon-label' ? (
          <>
            <UserRound className="h-4.5 w-4.5 text-[color:var(--app-text-soft)]" />
            {idLocale ? 'Akun' : 'Account'}
            <ChevronDown className="h-3.5 w-3.5 text-[color:var(--app-text-soft)]" />
          </>
        ) : (
          <>
            <Image
              src={avatar}
              alt={name}
              width={40}
              height={40}
              className={cn(
                'rounded-full object-cover',
                variant === 'avatar-role' ? 'h-9 w-9' : 'h-8 w-8',
              )}
            />
            {variant === 'avatar-role' ? (
              <div className="hidden min-w-0 text-left 2xl:block">
                <p className="max-w-[112px] truncate text-[12px] font-bold text-[color:var(--app-text)]">
                  {name}
                </p>
                <p className="text-[12px] text-[color:var(--app-text-soft)]">
                  {roleLabel || (idLocale ? 'Pengusaha' : 'Business Owner')}
                </p>
              </div>
            ) : (
              <span className="max-w-[112px] truncate text-xs font-semibold text-[color:var(--app-text)]">
                {name}
              </span>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[color:var(--app-text-soft)]',
                variant === 'avatar-role' ? 'hidden 2xl:block' : '',
              )}
            />
          </>
        )}
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={
              menuPosition
                ? {
                  left: menuPosition.left,
                  top: menuPosition.top,
                  width: menuPosition.width,
                  zIndex: 160,
                }
                : { visibility: 'hidden', zIndex: 160 }
            }
            className={cn(
              'fixed max-h-[min(78vh,620px)] overflow-y-auto rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 text-[color:var(--app-text)] shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]',
              menuClassName,
            )}
            data-auto-scrollbar
          >
            <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src={avatar}
                  alt={name}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{name}</p>
                  <p className="truncate text-xs text-[color:var(--app-text-soft)]">
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2 grid gap-1">
              {items.map(item => {
                const Icon = item.icon;
                const itemPath = hrefPath(item.href);
                const active =
                  itemPath === '/profile'
                    ? matchesRoute(cleanPath, '/profile$') ||
                    matchesRoute(cleanPath, '/profile/edit')
                    : matchesRoute(cleanPath, itemPath);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    className={cn(
                      'flex min-h-[42px] items-center gap-2 rounded-[14px] px-3 text-sm font-semibold transition hover:bg-[color:var(--app-surface-muted)]',
                      active
                        ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'text-[color:var(--app-text)]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="my-2 border-t border-[color:var(--app-border)]" />

            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {text.savedAccounts}
              </p>
              {savedAccounts.slice(0, 8).map(account => {
                const isCurrent = account.id === user?.id;

                return (
                  <div
                    key={account.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-[14px] px-2 py-1 hover:bg-[color:var(--app-surface-muted)]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isCurrent) void switchAccount(account);
                      }}
                      className="flex min-w-0 items-center gap-2 rounded-[12px] px-1 py-1 text-left"
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                        <Image
                          src={profileAvatarSrc(
                            account.avatarUrl,
                            account.avatarStyle,
                            account.displayName,
                          )}
                          alt=""
                          width={32}
                          height={32}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-[color:var(--app-text)]">
                          {account.displayName}
                        </span>
                        <span className="block truncate text-[11px] text-[color:var(--app-text-soft)]">
                          {isCurrent
                            ? text.current
                            : formatSavedAccountIdentifier(account)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAccount(account.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-danger-soft)] hover:text-[color:var(--app-danger)]"
                      aria-label={text.remove}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => void addAccount()}
                className="flex min-h-[40px] w-full items-center gap-2 rounded-[14px] px-3 text-sm font-semibold text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)]"
              >
                <Plus className="h-4 w-4" />
                {text.add}
              </button>
            </div>

            <div className="my-2 border-t border-[color:var(--app-border)]" />

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex min-h-[42px] w-full items-center gap-2 rounded-[14px] px-3 text-sm font-semibold text-[color:var(--app-danger)] hover:bg-[color:var(--app-danger-soft)]"
            >
              <LogOut className="h-4 w-4" />
              {text.logout}
            </button>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
