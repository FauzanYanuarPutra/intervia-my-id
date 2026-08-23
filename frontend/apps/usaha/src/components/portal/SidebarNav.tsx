import Link from 'next/link';
import {
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  ShieldCheck,
  ShoppingBag,
  Store,
  UsersRound,
} from 'lucide-react';
import { buildSectionHref } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type SidebarNavProps = {
  business: BusinessRecord | null;
  currentSection: PortalSection;
};

const groups: Array<{
  label: string;
  items: Array<{ id: PortalSection; label: string; icon: typeof Store }>;
}> = [
  { label: 'Ringkasan', items: [{ id: 'home', label: 'Beranda', icon: LayoutDashboard }] },
  { label: 'Penjualan', items: [{ id: 'orders', label: 'Pesanan', icon: ShoppingBag }] },
  { label: 'Katalog', items: [{ id: 'products', label: 'Produk', icon: Boxes }] },
  {
    label: 'Operasional',
    items: [
      { id: 'locations', label: 'Lokasi & Cabang', icon: MapPinned },
      { id: 'operations', label: 'Operasional', icon: ClipboardList },
    ],
  },
  {
    label: 'Bisnis',
    items: [
      { id: 'info', label: 'Profil usaha', icon: Building2 },
      { id: 'buyerPage', label: 'Halaman pembeli', icon: Store },
    ],
  },
  {
    label: 'Tim & keamanan',
    items: [
      { id: 'team', label: 'Tim', icon: UsersRound },
      { id: 'security', label: 'Keamanan', icon: ShieldCheck },
    ],
  },
];

export function SidebarNav({ business, currentSection }: SidebarNavProps) {
  if (!business) return null;

  return (
    <nav className="mt-5 space-y-5" aria-label="Navigasi usaha">
      {groups.map(group => (
        <div key={group.label}>
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">{group.label}</p>
          <div className="mt-1.5 space-y-1">
            {group.items.map(item => {
              const Icon = item.icon;
              const active = currentSection === item.id;
              return (
                <Link
                  key={item.id}
                  href={buildSectionHref(business.id, item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-10 items-center gap-3 rounded-[13px] px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${active ? 'bg-white text-portal-forest shadow-sm' : 'text-white/70 hover:bg-white/8 hover:text-white'}`}
                >
                  <Icon className="h-[17px] w-[17px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
