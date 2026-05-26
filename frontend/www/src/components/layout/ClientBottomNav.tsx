'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';
import {
  buildPrimaryNavItems,
  resolveActivePrimaryNavKey,
} from '@/components/system/navigation/PrimaryNav';
import { shouldShowMobileBottomNav } from '@/components/layout/mobileChromeRules';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { cn } from '@/lib/utils';

export function shouldHideMobileBottomNav(pathname: string | null) {
  return !shouldShowMobileBottomNav(pathname);
}

export default function ClientBottomNav() {
  const pathname = usePathname();
  const locale = resolveLocaleFromPathname(pathname);
  const { isAuthenticated } = useAuth();

  const items = useMemo(
    () => buildPrimaryNavItems(isAuthenticated, locale),
    [isAuthenticated, locale],
  );
  if (shouldHideMobileBottomNav(pathname)) return null;
  const activeKey = resolveActivePrimaryNavKey(items, pathname);

  return (
    <nav
      className="ui-layer-bottom-nav fixed inset-x-0 bottom-0 overflow-hidden border-x-0 border-t border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_97%,transparent)] px-1 pt-1 shadow-[0_-10px_24px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)]"
      data-compact-bottom-nav="true"
      data-testid="mobile-bottom-nav"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.125rem)' }}
      aria-label="Mobile primary navigation"
    >
      <div className="mx-auto w-full max-w-[720px]">
        <ul className="grid grid-cols-5 items-stretch gap-1">
          {items.map(item => {
            const Icon = item.icon;
            const active = activeKey === item.key;
            const isCreate = item.key === 'create';

            return (
              <li
                key={item.key}
                className="min-w-0"
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
                    'ui-pressable relative z-10 flex min-h-[45px] w-full touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-[12px] px-0.5 py-1 text-[10.5px] font-bold leading-none transition',
                    isCreate
                      ? active
                        ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)]'
                      : active
                        ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
                  )}
                  data-testid={`mobile-nav-${item.key}`}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-flex items-center justify-center transition',
                        isCreate
                          ? cn(
                            'h-7 w-7 rounded-full',
                            active
                              ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                              : 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]',
                          )
                        : cn(
                            'h-[26px] w-[26px] rounded-full',
                            active
                              ? 'bg-white text-[color:var(--app-accent)]'
                              : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                          ),
                      )}
                  >
                    <Icon
                      className={cn(
                        'pointer-events-none',
                        isCreate
                          ? 'h-3.5 w-3.5'
                          : 'h-3.5 w-3.5',
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      'pointer-events-none max-w-full truncate leading-none',
                      active && !isCreate && 'text-[color:var(--app-accent)]',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
