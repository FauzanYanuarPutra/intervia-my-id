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
  const visible = new Set(visiblePortalSections(business.permissions));
  const items = groups.flatMap(group => group.items).filter(item => visible.has(item.id));

  return (
    <nav className="mt-3 space-y-1" aria-label="Navigasi usaha">
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
    </nav>
  );
}
