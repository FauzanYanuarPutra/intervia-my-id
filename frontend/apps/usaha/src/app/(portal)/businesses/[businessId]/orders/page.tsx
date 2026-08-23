import { notFound } from 'next/navigation';
import { ClipboardCheck, Clock3, PackageCheck, ShoppingBag } from 'lucide-react';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

function orderTone(status: string): 'info' | 'warning' | 'success' | 'neutral' {
  if (status === 'baru') return 'info';
  if (status === 'diproses' || status === 'siap kirim') return 'warning';
  if (status === 'selesai') return 'success';
  return 'neutral';
}

export default async function BusinessOrdersPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canManage = hasPermission(business, 'manageOrders');
  const newOrders = business.orders.filter(order => order.status === 'baru').length;
  const processingOrders = business.orders.filter(order => order.status === 'diproses' || order.status === 'siap kirim').length;
  const completedOrders = business.orders.filter(order => order.status === 'selesai').length;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="orders">
      <SectionCard eyebrow="Penjualan" title="Pesanan" description="Pantau antrean berdasarkan status dan prioritaskan order yang perlu diproses lebih dulu.">
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Baru masuk" value={newOrders} icon={ShoppingBag} note="Belum mulai diproses" />
            <StatCard label="Sedang berjalan" value={processingOrders} icon={Clock3} note="Diproses atau siap kirim" />
            <StatCard label="Selesai" value={completedOrders} icon={PackageCheck} note="Tercatat pada data workspace" />
            <StatCard label="Akses" value={canManage ? 'Kelola' : 'Pantau'} icon={ClipboardCheck} note={canManage ? 'Dapat memproses pesanan' : 'Mode lihat saja'} />
          </section>

          <DataPanel title="Antrean pesanan" description={`${business.orders.length} pesanan tercatat untuk usaha ini.`}>
            {business.orders.length ? (
              <div>
                <div className="hidden grid-cols-[120px_minmax(180px,1fr)_minmax(220px,1.4fr)_130px_110px] gap-4 border-b border-portal-line bg-[#fafbf9] px-5 py-3 text-[11px] font-bold text-portal-soft lg:grid">
                  <span>ID</span><span>Pembeli</span><span>Pesanan</span><span>Total</span><span>Status</span>
                </div>
                <div className="divide-y divide-portal-line">
                  {business.orders.map(order => (
                    <article key={order.id} className="grid gap-3 px-4 py-4 transition hover:bg-[#fafbf9] sm:px-5 lg:grid-cols-[120px_minmax(180px,1fr)_minmax(220px,1.4fr)_130px_110px] lg:items-center lg:gap-4">
                      <div><p className="text-[11px] font-semibold text-portal-soft lg:hidden">ID pesanan</p><p className="mt-1 text-xs font-bold text-portal-ink lg:mt-0">{order.id}</p></div>
                      <div className="min-w-0"><p className="text-[11px] font-semibold text-portal-soft lg:hidden">Pembeli</p><p className="mt-1 truncate text-sm font-bold text-portal-ink lg:mt-0">{order.buyer}</p><p className="mt-1 text-xs text-portal-soft">{order.channel}</p></div>
                      <div className="min-w-0"><p className="text-[11px] font-semibold text-portal-soft lg:hidden">Pesanan</p><p className="mt-1 text-sm leading-5 text-portal-ink lg:mt-0">{order.itemSummary}</p></div>
                      <div><p className="text-[11px] font-semibold text-portal-soft lg:hidden">Total</p><p className="mt-1 text-sm font-bold text-portal-ink lg:mt-0">{order.amountLabel}</p></div>
                      <div><StatusBadge tone={orderTone(order.status)}>{order.status}</StatusBadge></div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState title="Belum ada pesanan" description="Begitu pesanan pertama masuk, antreannya akan tampil di sini untuk dipantau owner, manager, atau kasir sesuai akses." icon={ShoppingBag} />
            )}
          </DataPanel>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
