'use client';

import Link from 'next/link';
import { EmblaInlineRail } from '@/components/portal/EmblaInlineRail';

type TabItem = {
  id: string;
  label: string;
  href: string;
  badge?: string | number | null;
};

type WorkspaceTabsProps = {
  items: TabItem[];
  activeId: string;
  ariaLabel?: string;
};

export function WorkspaceTabs({
  items,
  activeId,
  ariaLabel = 'Pilihan tampilan',
}: WorkspaceTabsProps) {
  return (
    <nav className="min-w-0" aria-label={ariaLabel}>
      <EmblaInlineRail contentClassName="gap-2 px-0.5" itemClassName="shrink-0">
        {items.map(item => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={
                'merchant-chip min-h-10 gap-2 px-3.5 sm:min-h-9 ' +
                (active ? 'merchant-chip-active' : '')
              }
            >
              <span className="max-w-[13rem] truncate">{item.label}</span>
              {item.badge !== null && item.badge !== undefined ? (
                <span
                  className={
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ' +
                    (active ? 'bg-white/80' : 'bg-portal-mist')
                  }
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </EmblaInlineRail>
    </nav>
  );
}
