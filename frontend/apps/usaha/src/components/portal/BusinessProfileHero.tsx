import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BadgeCheck, MapPin, PencilLine, ShoppingBag } from 'lucide-react';
import { StatusBadge } from '@/components/portal/StatusBadge';
import type { BusinessRecord } from '@/lib/portal-types';
import { getStatusCopy, hasPermission } from '@/lib/portal-logic';

type BusinessProfileHeroProps = {
  business: BusinessRecord;
};

function stockAttentionCount(business: BusinessRecord) {
  return (business.lowStockProductsCount ?? 0) + (business.stockCheckCount ?? 0);
}

export function BusinessProfileHero({ business }: BusinessProfileHeroProps) {
  const status = getStatusCopy(business);
  const canManageInfo = hasPermission(business, 'manageInfo');
  const canSell = hasPermission(business, 'createSales');
  const canViewInventory = hasPermission(business, 'viewInventory');
  const canViewFinance = hasPermission(business, 'viewFinance');
  const canViewReports = hasPermission(business, 'viewReports');
  const stockAttention = stockAttentionCount(business);
  const location = business.city || business.address || 'Lokasi belum diisi';

  return (
    <section className="overflow-hidden rounded-[24px] border border-portal-line bg-white shadow-[0_18px_48px_-40px_rgba(15,23,42,.35)]">
      <div className="relative h-28 overflow-hidden bg-[linear-gradient(135deg,#dff5e8_0%,#f7faf7_55%,#e9f3ed_100%)] sm:h-36 lg:h-40">
        {business.bannerUrl ? (
          <Image
            src={business.bannerUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 1120px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/25" />
        <div className="absolute right-3 top-3">
          <StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{status.label}</StatusBadge>
        </div>
      </div>

      <div className="px-3 pb-4 sm:px-5 sm:pb-5">
        <div className="-mt-10 flex min-w-0 items-end gap-3 sm:-mt-12 sm:gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-[4px] border-white bg-[#f3f6f3] shadow-lg sm:h-24 sm:w-24">
            {business.logoUrl ? (
              <Image
                src={business.logoUrl}
                alt={business.name}
                fill
                unoptimized
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-black text-portal-forest">
                {business.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="min-w-0 truncate text-xl font-black tracking-[-0.03em] text-portal-ink sm:text-2xl">
                {business.name}
              </h1>
              {business.infoComplete ? <BadgeCheck className="h-5 w-5 shrink-0 fill-emerald-600 text-white" aria-label="Profil lengkap" /> : null}
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-portal-soft">
              <span className="font-semibold">{business.category || 'Usaha'}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {location}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 max-w-2xl">
          <p className="text-sm leading-6 text-portal-soft">
            {business.description?.trim() || 'Kelola produk, jualan, stok, dan uang dari satu tempat.'}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-portal-line rounded-2xl border border-portal-line py-2.5 sm:max-w-[620px]">
          <div className="px-2 text-center">
            <p className="text-base font-black text-portal-ink sm:text-lg">{business.products.length}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-portal-soft sm:text-xs">Produk</p>
          </div>
          <div className="px-2 text-center">
            <p className="text-base font-black text-portal-ink sm:text-lg">{business.activeOrders}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-portal-soft sm:text-xs">Pesanan</p>
          </div>
          <div className="px-2 text-center">
            <p className="text-base font-black text-portal-ink sm:text-lg">{stockAttention}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-portal-soft sm:text-xs">Perlu cek</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
          <Link href={canManageInfo ? `/businesses/${business.id}/info` : `/businesses/${business.id}/buyer-page`} className="portal-button-secondary">
            <PencilLine className="h-4 w-4" />
            {canManageInfo ? 'Edit profil' : 'Lihat profil'}
          </Link>
          {canSell ? (
            <Link href={`/businesses/${business.id}/orders`} className="portal-button-primary">
              <ShoppingBag className="h-4 w-4" /> Jual
            </Link>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
                    <Link href={`/businesses/${business.id}/products`} className="merchant-chip">Produk</Link>
          {canViewInventory ? <Link href={`/businesses/${business.id}/inventory`} className="merchant-chip">Stok</Link> : null}
          {canViewFinance ? <Link href={`/businesses/${business.id}/finance`} className="merchant-chip">Uang</Link> : null}
          {canViewReports ? <Link href={`/businesses/${business.id}/reports`} className="merchant-chip">Laporan <ArrowRight className="h-3.5 w-3.5" /></Link> : null}
        </div>
      </div>
    </section>
  );
}
