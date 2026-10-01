import { notFound, redirect } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { DataResetCenter } from '@/components/business-control/DataResetCenter';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessResetPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();
  if (!hasPermission(business, 'manageDataReset')) {
    redirect(`/businesses/${business.id}`);
  }

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="dataReset"
    >
      <PageHeader
        eyebrow="Pemulihan"
        title="Reset & mulai ulang data"
        description="Pilih area yang perlu dikembalikan ke keadaan awal tanpa menghapus histori penting."
        action={
          <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
            <RotateCcw className="h-4 w-4" />
            Tindakan sensitif
          </span>
        }
      />
      <DataResetCenter business={business} />
    </PortalShell>
  );
}
