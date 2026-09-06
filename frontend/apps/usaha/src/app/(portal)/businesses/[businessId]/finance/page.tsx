import { notFound } from 'next/navigation';
import { Banknote, CircleDollarSign, Info } from 'lucide-react';
import { FinanceLedger } from '@/components/business-control/FinanceLedger';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { listControlFinanceEntries } from '@/lib/business-control-server';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessFinancePage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewFinance');
  const entries = canView ? await listControlFinanceEntries(business.id) : [];

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="finance">
      <SectionCard eyebrow="Uang" title="Catat uang masuk dan keluar tanpa jadi akuntan" description="Transaksi tersimpan per usaha. Lajukan memisahkan omzet, biaya usaha, modal pemilik, dan ambil pribadi agar perubahan kas tidak disalahartikan sebagai laba.">
        {canView ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Banknote className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Uang masuk</p><p className="mt-1 text-xs leading-5 text-portal-soft">Penjualan, pendapatan lain, modal pemilik, atau piutang yang dibayar.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><CircleDollarSign className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Uang keluar</p><p className="mt-1 text-xs leading-5 text-portal-soft">Belanja bahan, kemasan, sewa, utilitas, gaji, promosi, alat, atau ambil pribadi.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Info className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Laba ≠ saldo kas</p><p className="mt-1 text-xs leading-5 text-portal-soft">Modal dan ambil pribadi memengaruhi kas tetapi dipisahkan dari hasil operasional.</p></div>
            </div>
            <FinanceLedger businessId={business.id} initialEntries={entries} />
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat laba, HPP, saldo, atau keuangan sensitif.</div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
