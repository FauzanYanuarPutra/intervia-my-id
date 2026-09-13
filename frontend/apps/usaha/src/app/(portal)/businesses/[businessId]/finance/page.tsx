import { notFound } from 'next/navigation';
import { Banknote, CircleDollarSign, Info } from 'lucide-react';
import { FinanceLedger } from '@/components/business-control/FinanceLedger';
import { FinancePlanningWorkspace } from '@/components/business-control/FinancePlanningWorkspace';
import { SettlementWorkspace } from '@/components/business-control/SettlementWorkspace';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import {
  getWave2FinancePlan,
  listWave2Obligations,
} from '@/lib/business-wave2-server';
import {
  listControlChannels,
  listControlFinanceEntries,
  listControlSettlements,
} from '@/lib/business-control-server';
import { shouldShowSettlementWorkspace } from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessFinancePage({ params }: PageProps) {
  const { businessId } = await params;
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
  const showSettlement = shouldShowSettlementWorkspace({
    canViewFinance: canView,
    enabledChannelCount: enabledChannels.length,
  });

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="finance">
      <SectionCard eyebrow="Uang" title="Tahu yang aman dipakai, lalu catat kejadian nyata" description="Target pembagian, tagihan rutin, dan uang aktual dipisahkan. Penjualan masuk otomatis dari Kasir supaya omzet tidak pernah dihitung dua kali.">
        {canView ? (
          <div className="space-y-4">
            <FinancePlanningWorkspace
              businessId={business.id}
              initialPlan={financePlan}
              initialObligations={obligations}
              entries={entries}
            />

            <details className="portal-panel group">
              <summary className="cursor-pointer list-none p-4 sm:p-5"><span className="font-bold text-portal-ink">Catat uang aktual</span><span className="ml-2 text-xs font-semibold text-portal-soft">Selain penjualan</span></summary>
              <div className="border-t border-portal-line p-3 sm:p-4">
                <FinanceLedger
                  businessId={business.id}
                  initialEntries={entries}
                  channels={enabledChannels.map(channel => ({ key: channel.channel_key, label: channel.display_name }))}
                />
              </div>
            </details>

            {showSettlement ? (
              <details className="portal-panel group">
                <summary className="cursor-pointer list-none p-4 sm:p-5"><span className="font-bold text-portal-ink">Cocokkan transfer aplikasi</span><span className="ml-2 text-xs font-semibold text-portal-soft">{enabledChannels.length} kanal aktif</span></summary>
                <div className="border-t border-portal-line p-3 sm:p-4">
                  <SettlementWorkspace
                    businessId={business.id}
                    initialSettlements={settlements}
                    initialChannels={enabledChannels.map(channel => ({ key: channel.channel_key, label: channel.display_name }))}
                  />
                </div>
              </details>
            ) : null}

            <details className="portal-panel group">
              <summary className="cursor-pointer list-none p-4 sm:p-5"><span className="font-bold text-portal-ink">Cara membaca uang usaha</span><span className="ml-2 text-xs font-semibold text-portal-soft">Penjelasan</span></summary>
              <div className="grid gap-3 border-t border-portal-line p-4 sm:grid-cols-3 sm:p-5">
                <div className="rounded-xl border border-portal-line p-4"><Banknote className="h-4 w-4 text-portal-forest" /><p className="mt-3 font-bold text-portal-ink">Uang masuk</p><p className="mt-1 text-xs leading-5 text-portal-soft">Penjualan dari Kasir, pendapatan lain, modal pemilik, atau piutang yang dibayar.</p></div>
                <div className="rounded-xl border border-portal-line p-4"><CircleDollarSign className="h-4 w-4 text-portal-forest" /><p className="mt-3 font-bold text-portal-ink">Uang keluar</p><p className="mt-1 text-xs leading-5 text-portal-soft">Belanja, sewa, utilitas, gaji, transport, atau Ambil owner.</p></div>
                <div className="rounded-xl border border-portal-line p-4"><Info className="h-4 w-4 text-portal-forest" /><p className="mt-3 font-bold text-portal-ink">Hasil usaha ≠ saldo kas</p><p className="mt-1 text-xs leading-5 text-portal-soft">Modal masuk dan Ambil owner mengubah kas, tetapi bukan pendapatan atau biaya operasi.</p></div>
              </div>
            </details>
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat laba, HPP, saldo, atau keuangan sensitif.</div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
