import Link from 'next/link';

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

export function WorkspaceTabs({ items, activeId, ariaLabel = 'Pilihan tampilan' }: WorkspaceTabsProps) {
  return (
    <nav className="-mx-1 overflow-x-auto px-1" aria-label={ariaLabel}>
      <div className="flex min-w-max gap-2">
        {items.map(item => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`merchant-chip gap-2 ${active ? 'merchant-chip-active' : ''}`}
            >
              {item.label}
              {item.badge !== null && item.badge !== undefined ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/80' : 'bg-portal-mist'}`}>
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
