import Link from 'next/link';
import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  Store,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { buildSectionHref, visiblePortalSections } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type SidebarNavProps = {
  business: BusinessRecord | null;
  currentSection: PortalSection;
};

const groups: Array<{
  label: string;
  items: Array<{ id: PortalSection; label: string; icon: typeof Store }>;
}> = [
  { label: 'Hari ini', items: [{ id: 'home', label: 'Beranda', icon: LayoutDashboard }] },
  {
    label: 'Jualan & uang',
    items: [
      { id: 'orders', label: 'Jualan', icon: ShoppingBag },
      { id: 'finance', label: 'Uang', icon: WalletCards },
      { id: 'reports', label: 'Laporan', icon: BarChart3 },
    ],
  },
  {
    label: 'Produk',
    items: [
      { id: 'products', label: 'Produk & HPP', icon: Calculator },
      { id: 'inventory', label: 'Stok & Belanja', icon: PackageSearch },
      { id: 'channels', label: 'Kanal Jual', icon: Boxes },
    ],
  },
  {
    label: 'Usaha',
    items: [
      { id: 'operations', label: 'Operasional', icon: ClipboardList },
      { id: 'info', label: 'Profil usaha', icon: Building2 },
      { id: 'locations', label: 'Lokasi & Outlet', icon: MapPinned },
      { id: 'buyerPage', label: 'Halaman pembeli', icon: Store },
    ],
  },
  {
    label: 'Akses',
    items: [
      { id: 'team', label: 'Tim', icon: UsersRound },
      { id: 'security', label: 'Keamanan', icon: ShieldCheck },
    ],
  },
];

export function SidebarNav({ business, currentSection }: SidebarNavProps) {
  if (!business) return null;
  const visible = new Set(visiblePortalSections(business.permissions));

  return (
    <nav className="mt-3 space-y-4" aria-label="Navigasi usaha">
      {groups.map(group => {
        const items = group.items.filter(item => visible.has(item.id));
        if (!items.length) return null;
        return (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[.12em] text-portal-soft/70">{group.label}</p>
            <div className="space-y-1">
              {items.map(item => {
                const Icon = item.icon;
                const active = currentSection === item.id;
                return (
                  <Link
                    key={item.id}
                    href={buildSectionHref(business.id, item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${active ? 'bg-portal-mist text-portal-forest' : 'text-portal-soft hover:bg-[#f4f6f4] hover:text-portal-ink'}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
