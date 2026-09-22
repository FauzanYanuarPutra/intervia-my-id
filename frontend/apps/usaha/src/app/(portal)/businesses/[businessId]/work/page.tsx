import { notFound } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { WorkQueue } from '@/components/portal/WorkQueue';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import {
  listBusinessWork,
} from '@/lib/business-work-server';
import {
  listOrganizationMembersForBusiness,
} from '@/lib/business-collaboration-server';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessWorkPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business || !account) notFound();

  const canManage = business.currentRole === 'owner' || business.currentRole === 'manager';
  const [items, members] = await Promise.all([
    listBusinessWork(business.id),
    canManage ? listOrganizationMembersForBusiness(business.id).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account.name}
      currentSection="team"
    >
      <PageHeader
        eyebrow="Tim & akses"
        title="Pekerjaan usaha"
        description="Kondisi usaha diterjemahkan menjadi pekerjaan yang jelas, lalu dibagikan ke orang yang tepat."
        meta={<span className="portal-icon-tile"><ClipboardCheck className="h-4 w-4" /></span>}
      />
      <WorkQueue
        businessId={business.id}
        initialItems={items}
        members={members}
        currentUserId={account.id}
        canManage={canManage}
      />
    </PortalShell>
  );
}
