import { notFound } from 'next/navigation';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';

type PageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessOrdersPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;

  if (!business) {
    notFound();
  }

  const canManage = hasPermission(business, 'manageOrders');
  const newOrders = business.orders.filter(order => order.status === 'baru').length;
  const processingOrders = business.orders.filter(
    order => order.status === 'diproses',
  ).length;

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="orders"
    >
      <SectionCard
        eyebrow="Pesanan"
        title="Antrean order dibuat singkat dan jelas"
        description="Antrean utama."
      >
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                Baru masuk
              </p>
              <p className="mt-2 text-xl font-black tracking-[-0.04em] text-portal-ink">
                {newOrders}
              </p>
            </div>
            <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                Sedang diproses
              </p>
              <p className="mt-2 text-xl font-black tracking-[-0.04em] text-portal-ink">
                {processingOrders}
              </p>
            </div>
            <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                Mode akses
              </p>
              <p className="mt-2 text-xl font-black tracking-[-0.04em] text-portal-ink">
                {canManage ? 'Bisa proses' : 'Pantau saja'}
              </p>
            </div>
          </div>

          {business.orders.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {business.orders.map(order => (
                <article
                  key={order.id}
                  className="rounded-[24px] border border-portal-line/70 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                        {order.id}
                      </p>
                      <h3 className="mt-1 text-lg font-black tracking-[-0.04em] text-portal-ink">
                        {order.buyer}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-portal-soft">
                        {order.itemSummary}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-portal-ink">{order.amountLabel}</p>
                      <p className="mt-1 text-sm text-portal-soft">{order.channel}</p>
                    </div>
                  </div>
                  <div className="mt-4 inline-flex rounded-full border border-portal-line bg-portal-sand/45 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-portal-ink">
                    {order.status}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-portal-line bg-portal-sand/40 p-6 text-sm leading-7 text-portal-soft">
              Belum ada order aktif. Begitu order pertama masuk, halaman ini harus jadi tempat
              pertama yang dibuka kasir atau manager.
            </div>
          )}
        </div>
      </SectionCard>
    </PortalShell>
  );
}
