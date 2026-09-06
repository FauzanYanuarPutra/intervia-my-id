import { notFound } from 'next/navigation';
import { Boxes, Info, Store } from 'lucide-react';
import { ChannelSettingsWorkspace } from '@/components/business-control/ChannelSettingsWorkspace';
import { MerchantCopyPack } from '@/components/business-control/MerchantCopyPack';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { listControlChannels } from '@/lib/business-control-server';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessChannelsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewChannels');
  const channels = canView ? await listControlChannels(business.id) : [];
  const product = business.products.find(item => item.status === 'live') ?? business.products[0];
  const numericPrice = Number((product?.priceLabel ?? '').replace(/[^0-9]/g, '')) || 15000;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="channels">
      <SectionCard eyebrow="Kanal Jual" title="Satu data untuk semua tempat jualan" description="Profil usaha tetap canonical, sementara asumsi fee, promo, dan target margin disimpan per kanal. Tidak perlu mengingat angka berbeda setiap kali mengecek harga.">
        {canView ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Store className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Profil canonical</p><p className="mt-1 text-xs leading-5 text-portal-soft">Nama, alamat, kontak, deskripsi, dan jam operasional berasal dari satu profil.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Boxes className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Asumsi tersimpan</p><p className="mt-1 text-xs leading-5 text-portal-soft">Fee, promo merchant, biaya tetap, target margin, dan status aktif disimpan per kanal.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Info className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Tidak hard-code fee</p><p className="mt-1 text-xs leading-5 text-portal-soft">Angka platform bisa berubah atau berbeda per merchant. Anda tetap pemilik asumsi komersialnya.</p></div>
            </div>

            <MerchantCopyPack business={business} />

            <div>
              <div className="mb-3"><p className="portal-kicker">Harga & margin per kanal</p><h2 className="mt-1 text-lg font-bold text-portal-ink">Bandingkan sebelum pasang harga</h2><p className="mt-1 text-sm text-portal-soft">Harga awal memakai {product?.name ?? 'produk utama'}. Masukkan HPP hasil resep untuk melihat sisa bersih dan harga minimum target.</p></div>
              <ChannelSettingsWorkspace businessId={business.id} initialChannels={channels} defaultPrice={numericPrice} />
            </div>
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses mengelola kanal jual dan asumsi margin.</div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
