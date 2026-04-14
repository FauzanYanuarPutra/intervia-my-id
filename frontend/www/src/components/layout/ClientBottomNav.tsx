'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import {
  buildPrimaryNavItems,
  resolveActivePrimaryNavKey,
} from '@/components/system/navigation/PrimaryNav';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { cn } from '@/lib/utils';

export default function ClientBottomNav() {
  const pathname = usePathname();
  const locale = resolveLocaleFromPathname(pathname);
  const { isAuthenticated } = useAuth();

  const items = useMemo(
    () => buildPrimaryNavItems(isAuthenticated, locale),
    [isAuthenticated, locale],
  );
  const activeKey = resolveActivePrimaryNavKey(items, pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-2 pt-1.5 lg:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      aria-label="Mobile primary navigation"
    >
      <div className="mx-auto max-w-lg rounded-[28px] border border-[color:color-mix(in_srgb,_var(--app-border)_88%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_94%,_transparent)] px-2 pb-2 pt-1.5 shadow-[0_24px_44px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_68%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_96%,_transparent)]">
        <ul className="grid grid-cols-5 items-end gap-1">
          {items.map(item => {
            const Icon = item.icon;
            const active = activeKey === item.key;
            const isCreate = item.key === 'create';

            return (
              <li
                key={item.key}
                className={cn('min-w-0', isCreate && 'relative -mt-3')}
              >
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={
                    active
                      ? locale === 'id'
                        ? `${item.label} sedang aktif`
                        : `${item.label} is active`
                      : locale === 'id'
                        ? `Buka ${item.label}`
                        : `Open ${item.label}`
                  }
                  className={cn(
                    'ui-pressable relative z-10 flex min-h-[58px] w-full touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-[20px] px-1.5 pb-1 pt-1 text-[10px] font-semibold transition min-[360px]:min-h-[60px]',
                    isCreate
                      ? active
                        ? 'text-[color:var(--app-accent)]'
                        : 'text-[color:var(--app-text)]'
                      : active
                        ? 'text-[color:var(--app-accent)]'
                        : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-flex items-center justify-center transition',
                      isCreate
                        ? cn(
                            'h-12 w-12 rounded-full border shadow-[var(--app-shadow)] min-[360px]:h-[3.25rem] min-[360px]:w-[3.25rem]',
                            active
                              ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                              : 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_72%,_transparent)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]',
                          )
                        : cn(
                            'h-10 w-10 rounded-full',
                            active
                              ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                              : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                          ),
                    )}
                  >
                    <Icon
                      className={cn(
                        'pointer-events-none',
                        isCreate
                          ? 'h-5 w-5'
                          : 'h-4 w-4',
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      'pointer-events-none truncate leading-none',
                      active && !isCreate && 'text-[color:var(--app-accent)]',
                    )}
                  >
                    {item.label}
                  </span>
                  {active && !isCreate ? (
                    <span className="pointer-events-none mt-0.5 h-0.5 w-3 rounded-full bg-[color:var(--app-accent)] min-[360px]:w-3.5" />
                  ) : (
                    <span className="pointer-events-none mt-0.5 h-0.5 w-3 rounded-full bg-transparent min-[360px]:w-3.5" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
