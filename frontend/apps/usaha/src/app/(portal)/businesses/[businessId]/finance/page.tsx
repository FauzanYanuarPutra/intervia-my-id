import { notFound } from 'next/navigation';
import { Banknote, CircleDollarSign, Info } from 'lucide-react';
import { FinanceLedger } from '@/components/business-control/FinanceLedger';
import { FinancePlanningWorkspace } from '@/components/business-control/FinancePlanningWorkspace';
import { SettlementWorkspace } from '@/components/business-control/SettlementWorkspace';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { WorkspaceTabs } from '@/components/portal/WorkspaceTabs';
import { getWave2FinancePlan, listWave2Obligations } from '@/lib/business-wave2-server';
import { listControlChannels, listControlFinanceEntries, listControlSettlements } from '@/lib/business-control-server';
import { shouldShowSettlementWorkspace } from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

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
  const [entries, settlements, channels, financePlan, obligations] = canView
    ? await Promise.all([
        listControlFinanceEntries(business.id),
        listControlSettlements(business.id),
        listControlChannels(business.id),
        getWave2FinancePlan(business.id),
        listWave2Obligations(business.id),
      ])
    : [[], [], [], null, []];
  const enabledChannels = channels.filter(channel => channel.enabled);
  const showSettlement = canView;
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
            <FinanceLedger
              businessId={business.id}
              initialEntries={entries}
              channels={enabledChannels.map(channel => ({ key: channel.channel_key, label: channel.display_name }))}
            />
          ) : null}

          {activeView === 'plan' ? (
            <FinancePlanningWorkspace businessId={business.id} initialPlan={financePlan} initialObligations={obligations} entries={entries} />
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
