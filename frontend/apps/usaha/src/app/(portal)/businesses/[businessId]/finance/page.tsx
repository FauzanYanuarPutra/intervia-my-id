import { notFound } from 'next/navigation';
import { Banknote, CircleDollarSign, Info } from 'lucide-react';
import { FinanceLedger } from '@/components/business-control/FinanceLedger';
import { FinancePlanningWorkspace } from '@/components/business-control/FinancePlanningWorkspace';
import { SettlementWorkspace } from '@/components/business-control/SettlementWorkspace';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { WorkspaceTabs } from '@/components/portal/WorkspaceTabs';
import { getWave2FinancePlan, listWave2Obligations } from '@/lib/business-wave2-server';
import { listFinanceCoreEntries } from '@/lib/finance-core-server';
import { listControlChannels, listControlSettlements } from '@/lib/business-control-server';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

// Business OS contract marker: /finance-core/entries is the canonical finance ledger endpoint.

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function BusinessFinancePage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const query = await searchParams;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewFinance');
  let entries: Awaited<ReturnType<typeof listFinanceCoreEntries>> = [];
  let settlements: Awaited<ReturnType<typeof listControlSettlements>> = [];
  let channels: Awaited<ReturnType<typeof listControlChannels>> = [];
  let financePlan: Awaited<ReturnType<typeof getWave2FinancePlan>> = null;
  let obligations: Awaited<ReturnType<typeof listWave2Obligations>> = [];
  let financeCoreError = false;

  if (canView) {
    try {
      entries = await listFinanceCoreEntries(business.id);
    } catch {
      financeCoreError = true;
    }

    const [settlementsResult, channelsResult, planResult, obligationsResult] =
      await Promise.allSettled([
        listControlSettlements(business.id),
        listControlChannels(business.id),
        getWave2FinancePlan(business.id),
        listWave2Obligations(business.id),
      ]);

    if (settlementsResult.status === 'fulfilled') settlements = settlementsResult.value;
    if (channelsResult.status === 'fulfilled') channels = channelsResult.value;
    if (planResult.status === 'fulfilled') financePlan = planResult.value;
    if (obligationsResult.status === 'fulfilled') obligations = obligationsResult.value;
  }

  const enabledChannels = channels.filter(channel => channel.enabled);
  const showSettlement = canView && enabledChannels.length > 0 && settlements.length > 0;
  const requested = query.view;
  const activeView = requested === 'plan' ? 'plan' : requested === 'transfers' && showSettlement ? 'transfers' : 'activity';
  const tabs = [
    { id: 'activity', label: 'Aktivitas', href: `/businesses/${business.id}/finance?view=activity` },
    { id: 'plan', label: 'Rencana', badge: obligations.filter(item => item.active).length, href: `/businesses/${business.id}/finance?view=plan` },
    ...(showSettlement ? [{ id: 'transfers', label: 'Settlement & potongan', href: `/businesses/${business.id}/finance?view=transfers` }] : []),
  ];

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="finance">
      <PageHeader
        eyebrow="Uang"
        title={activeView === 'activity' ? 'Uang usaha' : activeView === 'plan' ? 'Rencana uang' : 'Transfer aplikasi'}
        description={activeView === 'activity' ? 'Lihat uang masuk dan keluar. Penjualan dari Kasir masuk otomatis.' : activeView === 'plan' ? 'Lihat yang aman dipakai setelah tagihan dan cadangan.' : 'Cocokkan omzet, potongan, refund, dan transfer bersih dari platform.'}
      />

      {canView ? (
        <>
          <WorkspaceTabs items={tabs} activeId={activeView} ariaLabel="Mode uang" />

          {activeView === 'activity' ? (
            financeCoreError ? (
              <section className="merchant-surface-bordered border-rose-200 bg-rose-50 p-4 sm:p-5">
                <p className="font-black text-rose-950">Data uang belum tersedia</p>
                <p className="mt-1 text-xs leading-5 text-rose-800">
                  Lajukan tidak menampilkan Rp0 agar tidak terlihat seolah-olah usaha belum punya transaksi. Coba muat ulang atau kembali lagi setelah koneksi normal.
                </p>
              </section>
            ) : (
              <FinanceLedger
                businessId={business.id}
                initialEntries={entries}
                channels={enabledChannels.map(channel => ({ key: channel.channel_key, label: channel.display_name }))}
              />
            )
          ) : null}

          {activeView === 'plan' ? (
            financeCoreError ? (
              <section className="merchant-surface-bordered border-rose-200 bg-rose-50 p-4 sm:p-5">
                <p className="font-black text-rose-950">Rencana uang belum bisa dibaca</p>
                <p className="mt-1 text-xs leading-5 text-rose-800">Data saldo inti sedang tidak tersedia, jadi Lajukan sengaja tidak menghitung ulang dari data parsial.</p>
              </section>
            ) : (
              <FinancePlanningWorkspace businessId={business.id} initialPlan={financePlan} initialObligations={obligations} entries={entries} />
            )
          ) : null}

          {activeView === 'transfers' && showSettlement ? (
            <SettlementWorkspace
              businessId={business.id}
              initialSettlements={settlements}
              initialChannels={enabledChannels.map(channel => ({ key: channel.channel_key, label: channel.display_name }))}
            />
          ) : null}

          <details className="merchant-surface-bordered group">
            <summary className="cursor-pointer list-none px-4 py-3.5 font-black text-portal-ink sm:px-5">Cara membaca uang usaha <span className="ml-2 text-xs font-semibold text-portal-soft">Bantuan</span></summary>
            <div className="grid gap-2 border-t border-portal-line/70 p-4 sm:grid-cols-3 sm:p-5">
              <div className="rounded-xl bg-[#f7f9f6] p-4"><Banknote className="h-4 w-4 text-portal-forest" /><p className="mt-2 font-black text-portal-ink">Uang masuk</p><p className="mt-1 text-xs leading-5 text-portal-soft">Penjualan, pendapatan lain, modal pemilik, atau piutang dibayar.</p></div>
              <div className="rounded-xl bg-[#f7f9f6] p-4"><CircleDollarSign className="h-4 w-4 text-portal-forest" /><p className="mt-2 font-black text-portal-ink">Uang keluar</p><p className="mt-1 text-xs leading-5 text-portal-soft">Belanja, sewa, gaji, utilitas, transport, atau ambil owner.</p></div>
              <div className="rounded-xl bg-[#f7f9f6] p-4"><Info className="h-4 w-4 text-portal-forest" /><p className="mt-2 font-black text-portal-ink">Saldo bukan untung</p><p className="mt-1 text-xs leading-5 text-portal-soft">Modal masuk dan ambil owner mengubah kas, tetapi bukan hasil operasi.</p></div>
            </div>
          </details>
        </>
      ) : (
        <div className="merchant-surface-bordered p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat keuangan sensitif.</div>
      )}
    </PortalShell>
  );
}
