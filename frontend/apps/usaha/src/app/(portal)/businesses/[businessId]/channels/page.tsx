import { notFound } from 'next/navigation';
import { Boxes, Info, Store } from 'lucide-react';
import { ChannelPriceCalculator } from '@/components/business-control/ChannelPriceCalculator';
import { MerchantCopyPack } from '@/components/business-control/MerchantCopyPack';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessChannelsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewChannels');
  const product = business.products.find(item => item.status === 'live') ?? business.products[0];
  const numericPrice = Number((product?.priceLabel ?? '').replace(/[^0-9]/g, '')) || 15000;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="channels">
      <SectionCard eyebrow="Kanal Jual" title="Satu data untuk semua tempat jualan" description="Rapikan profil dan harga di Lajukan, lalu gunakan kembali saat mengelola GoFood, GrabFood, ShopeeFood, WhatsApp, dan kanal lain.">
        {canView ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Store className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Profil canonical</p><p className="mt-1 text-xs leading-5 text-portal-soft">Nama, alamat, kontak, deskripsi dan jam operasional berasal dari satu profil.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Boxes className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Harga beda per kanal</p><p className="mt-1 text-xs leading-5 text-portal-soft">Masukkan potongan sesuai kondisi merchant Anda, lalu lihat margin dan harga minimum.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Info className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Tidak hard-code fee</p><p className="mt-1 text-xs leading-5 text-portal-soft">Biaya platform/promo bisa berbeda. Semua asumsi komersial di halaman ini dikendalikan user.</p></div>
            </div>

            <MerchantCopyPack business={business} />

            <div>
              <div className="mb-3"><p className="portal-kicker">Simulator harga</p><h2 className="mt-1 text-lg font-bold text-portal-ink">Cek margin sebelum pasang harga</h2><p className="mt-1 text-sm text-portal-soft">Contoh memakai {product?.name ?? 'produk utama'}. HPP contoh dapat diganti manual sampai persistence resep selesai.</p></div>
              <div className="grid gap-4 xl:grid-cols-3">
                <ChannelPriceCalculator channel="GoFood" defaultPrice={numericPrice} />
                <ChannelPriceCalculator channel="GrabFood" defaultPrice={numericPrice} />
                <ChannelPriceCalculator channel="ShopeeFood" defaultPrice={numericPrice} />
              </div>
            </div>
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses mengelola kanal jual dan asumsi margin.</div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
