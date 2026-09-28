'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BanknoteArrowDown,
  ClipboardCheck,
  PackagePlus,
  Plus,
  ShoppingBag,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { ModalSurface } from '@/components/interaction/ModalSurface';
import type { BusinessRecord, PermissionId } from '@/lib/portal-types';

type QuickCreateMenuProps = {
  business: BusinessRecord | null;
  mobile?: boolean;
};

type QuickAction = {
  permission: PermissionId;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

export function QuickCreateMenu({ business, mobile = false }: QuickCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!business) return null;

  const quickActions: QuickAction[] = [
    {
      permission: 'manageProducts',
      title: 'Tambah produk',
      description: 'Masukkan nama, harga, foto, dan stok awal.',
      href: `/businesses/${business.id}/products?create=1`,
      icon: PackagePlus,
      tone: 'bg-portal-catalogTint text-portal-catalog',
    },
    {
      permission: 'manageInventory',
      title: 'Perbarui stok',
      description: 'Cek barang tipis atau masuk ke bahan usaha.',
      href: `/businesses/${business.id}/inventory`,
      icon: PackagePlus,
      tone: 'bg-portal-stockTint text-portal-stock',
    },
    {
      permission: 'manageFinance',
      title: 'Catat uang keluar',
      description: 'Simpan biaya saat benar-benar terjadi.',
      href: `/businesses/${business.id}/finance?view=activity`,
      icon: BanknoteArrowDown,
      tone: 'bg-portal-moneyTint text-portal-money',
    },
    {
      permission: 'manageOperations',
      title: 'Buat pekerjaan',
      description: 'Jadikan kebutuhan usaha sebagai tugas yang jelas.',
      href: `/businesses/${business.id}/work`,
      icon: ClipboardCheck,
      tone: 'bg-portal-mist text-portal-forest',
    },
  ];
  const actions = quickActions.filter(action => business.permissions.includes(action.permission));

  if (!actions.length) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Tambah data usaha"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Tambah data usaha"
        onClick={() => setOpen(true)}
        className={mobile
          ? 'portal-quick-create-fab portal-touch-target'
          : 'portal-button-primary hidden lg:inline-flex'}
      >
        <Plus className="h-4 w-4" />
        {!mobile ? <span>Tambah</span> : null}
      </button>

      <ModalSurface
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Tambah data usaha"
        presentation="adaptive"
        size="md"
        returnFocusRef={triggerRef}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-portal-line px-4 pb-3 pt-4 sm:px-5">
            <div>
              <p className="portal-kicker">Tambah data</p>
              <h2 className="mt-1 text-xl font-black tracking-[-.035em] text-portal-ink">Mau menambahkan apa?</h2>
              <p className="mt-1 text-xs leading-5 text-portal-soft">Pilih satu tindakan. Detailnya akan mengikuti aturan dan akses usahamu.</p>
            </div>
            <button
              type="button"
              aria-label="Tutup aksi cepat"
              onClick={() => setOpen(false)}
              className="portal-icon-button text-portal-soft hover:bg-portal-mist hover:text-portal-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="grid gap-2">
              {actions.map(action => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    onClick={() => setOpen(false)}
                    className="group flex min-h-[68px] items-center gap-3 rounded-2xl border border-portal-line bg-white px-3.5 py-3 transition hover:border-portal-forest/30 hover:bg-portal-mist/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20"
                  >
                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.tone}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-portal-ink">{action.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-portal-soft">{action.description}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-portal-soft transition group-hover:translate-x-0.5 group-hover:text-portal-forest" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </ModalSurface>
    </>
  );
}
