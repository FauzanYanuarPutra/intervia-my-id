import { notFound } from 'next/navigation';
import { Handshake } from 'lucide-react';
import { PartyDirectoryWorkspace } from '@/components/business-control/PartyDirectoryWorkspace';
import {
  listCommercialPayables,
  listCommercialParties,
  listCommercialReceivables,
  type CommercialPayable,
  type CommercialParty,
  type CommercialReceivable,
} from '@/lib/business-commercial-core-server';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessPartiesPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business || !account) notFound();

  const canView =
    hasPermission(business, 'viewOrders') ||
    hasPermission(business, 'viewFinance') ||
    hasPermission(business, 'viewInventory');
  if (!canView) notFound();

  const canManage =
    hasPermission(business, 'manageOrders') ||
    hasPermission(business, 'manageFinance') ||
    hasPermission(business, 'manageInventory') ||
    hasPermission(business, 'manageInfo');

  const [partyResult, receivableResult, payableResult] =
    await Promise.allSettled([
      listCommercialParties(business.id),
      listCommercialReceivables(business.id),
      listCommercialPayables(business.id),
    ]);

  const parties =
    partyResult.status === 'fulfilled'
      ? partyResult.value
      : ([] as CommercialParty[]);
  const receivables =
    receivableResult.status === 'fulfilled'
      ? receivableResult.value
      : ([] as CommercialReceivable[]);
  const payables =
    payableResult.status === 'fulfilled'
      ? payableResult.value
      : ([] as CommercialPayable[]);
  const loadError =
    partyResult.status === 'rejected' ||
    receivableResult.status === 'rejected' ||
    payableResult.status === 'rejected';

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account.name}
      currentSection="parties"
    >
      <PageHeader
        eyebrow="Pelanggan & mitra"
        title="Pelanggan & Mitra"
        description="Satu tempat untuk pelanggan, supplier, dan pihak usaha yang terkait dengan penjualan, pembelian, piutang, atau utang."
        meta={<span className="portal-icon-tile"><Handshake className="h-4 w-4" /></span>}
      />
      <PartyDirectoryWorkspace
        businessId={business.id}
        initialParties={parties}
        initialReceivables={receivables}
        initialPayables={payables}
        canManage={canManage}
        loadError={loadError}
      />
    </PortalShell>
  );
}
