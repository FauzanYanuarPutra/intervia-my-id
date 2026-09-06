import { notFound } from 'next/navigation';
import { Banknote, CircleDollarSign, Info } from 'lucide-react';
import { ProfitExplainer } from '@/components/business-control/ProfitExplainer';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessFinancePage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewFinance');

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="finance">
      <SectionCard eyebrow="Uang" title="Tahu untung tanpa jadi akuntan" description="Mulai dari uang masuk dan keluar. Lajukan memisahkan omzet, HPP, biaya usaha, modal pemilik, dan ambil pribadi supaya angka tidak menipu.">
        {canView ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Banknote className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">+ Uang masuk</p><p className="mt-1 text-xs leading-5 text-portal-soft">Penjualan, modal pemilik, piutang dibayar, atau pendapatan lain.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><CircleDollarSign className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">+ Uang keluar</p><p className="mt-1 text-xs leading-5 text-portal-soft">Belanja bahan, kemasan, listrik, sewa, gaji, marketing, alat, atau ambil pribadi.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Info className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Bahasa sederhana</p><p className="mt-1 text-xs leading-5 text-portal-soft">Debit/kredit dan detail jurnal tidak dipaksa muncul di flow harian merchant.</p></div>
            </div>
            <ProfitExplainer />
            <div className="rounded-2xl border border-portal-line bg-white p-4 text-xs leading-5 text-portal-soft">Simulator ini belum menyimpan transaksi. Data keuangan durable akan masuk endpoint canonical `marketplace_service` pada wave persistence; sampai itu selesai, angka di sini hanya alat bantu perhitungan dan edukasi.</div>
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat laba, HPP, saldo, atau keuangan sensitif.</div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
