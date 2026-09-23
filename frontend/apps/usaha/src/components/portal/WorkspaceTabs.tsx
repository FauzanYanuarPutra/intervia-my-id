'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

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
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeId]);

  return (
    <nav className="workspace-tab-scroller -mx-1 px-1" aria-label={ariaLabel}>
      <div className="flex min-w-max gap-2" role="list">
        {items.map(item => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              ref={active ? activeRef : undefined}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`merchant-chip min-h-10 snap-start gap-2 px-3.5 sm:min-h-9 ${active ? 'merchant-chip-active' : ''}`}
              role="listitem"
            >
              <span className="max-w-[13rem] truncate">{item.label}</span>
              {item.badge !== null && item.badge !== undefined ? (
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/80' : 'bg-portal-mist'}`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
