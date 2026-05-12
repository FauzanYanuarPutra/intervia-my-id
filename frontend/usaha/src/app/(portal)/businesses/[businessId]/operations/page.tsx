import { notFound } from 'next/navigation';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { OperationsQuickForm } from '@/components/forms/OperationsQuickForm';

type PageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessOperationsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;

  if (!business) {
    notFound();
  }

  const canManage = hasPermission(business, 'manageOperations');
  const flaggedProducts = business.products.filter(
    product =>
      product.stockHealth === 'tipis' ||
      product.stockHealth === 'habis' ||
      product.stockHealth === 'perlu-cocokkan',
  );

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="operations"
    >
      <SectionCard
        eyebrow="Operasional"
        title="Atur buka tutup dengan singkat"
        description="Status outlet."
      >
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="grid gap-4">
              <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
                <p className="portal-kicker">{canManage ? 'Atur operasional' : 'Status saat ini'}</p>
                {canManage ? (
                  <div className="mt-4">
                    <OperationsQuickForm business={business} />
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 text-sm text-portal-soft">
                    <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                      Status: {business.isOpen ? 'Sedang buka' : 'Belum buka'}
                    </div>
                    <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                      Jam buka: {business.schedule}
                    </div>
                  </div>
                )}
              </article>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                    Status usaha
                  </p>
                  <p className="mt-2 text-lg font-black tracking-[-0.04em] text-portal-ink">
                    {business.isOpen ? 'Sedang buka' : 'Belum buka'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                    Jam buka
                  </p>
                  <p className="mt-2 text-lg font-black tracking-[-0.04em] text-portal-ink">
                    {business.schedule}
                  </p>
                </div>
                <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                    Stok tipis / habis
                  </p>
                  <p className="mt-2 text-lg font-black tracking-[-0.04em] text-portal-ink">
                    {business.lowStockProductsCount ?? 0}
                  </p>
                </div>
              </div>

              <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
                <p className="portal-kicker">Checklist stok harian</p>
                <div className="mt-4 grid gap-3">
                  {flaggedProducts.length > 0 ? (
                    flaggedProducts.map(product => (
                      <div
                        key={product.id}
                        className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-portal-ink">
                              {product.name}
                            </p>
                            <p className="mt-1 text-sm text-portal-soft">
                              {product.ownerLabel} - {product.stockLabel}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-portal-ink">
                            {product.stockHealth === 'tipis'
                              ? 'Stok tipis'
                              : product.stockHealth === 'habis'
                                ? 'Habis'
                                : 'Perlu cocokkan'}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-portal-soft">
                          {product.stockMode === 'estimated'
                            ? 'Mode estimasi dipakai. Cocokkan fisik sebelum buka atau sebelum shift sore.'
                            : 'Sudah dihitung manual, tapi perlu aksi restock atau follow-up.'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-portal-line bg-portal-sand/35 px-4 py-4 text-sm text-portal-soft">
                      Belum ada item yang butuh pengecekan stok. Kalau nanti user malas update,
                      pakai mode estimasi saat input produk agar item tetap naik ke checklist ini.
                    </div>
                  )}
                </div>
              </article>
            </div>
          </div>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
