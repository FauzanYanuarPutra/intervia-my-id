import { notFound } from 'next/navigation';
import { Clock3, PackageCheck, ShoppingBag } from 'lucide-react';
import { CashShiftWorkspace } from '@/components/business-control/CashShiftWorkspace';
import { QuickSaleWorkspace } from '@/components/business-control/QuickSaleWorkspace';
import { EmptyState } from '@/components/portal/EmptyState';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { WorkspaceTabs } from '@/components/portal/WorkspaceTabs';
import { getCurrentWave2CashShift } from '@/lib/business-wave2-server';
import { listControlSales } from '@/lib/business-control-server';
import { jakartaDateKey } from '@/lib/business-control/insights';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ view?: string }>;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
});

function orderTone(status: string): 'info' | 'warning' | 'success' | 'neutral' {
  if (status === 'baru') return 'info';
  if (status === 'diproses' || status === 'siap kirim') return 'warning';
  if (status === 'selesai') return 'success';
  return 'neutral';
}

export default async function BusinessOrdersPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const query = await searchParams;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canManageOrders = hasPermission(business, 'manageOrders');
  const canCreateSales = hasPermission(business, 'createSales');
  const canViewTransactions = hasPermission(business, 'viewTransactions');
  const canCloseCashShift = hasPermission(business, 'closeCashShift');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const [sales, currentShift] = await Promise.all([
    canViewTransactions ? listControlSales(business.id) : Promise.resolve([]),
    canCloseCashShift ? getCurrentWave2CashShift(business.id) : Promise.resolve(null),
  ]);

  const saleProducts = business.products.filter(product => product.status === 'live').map(product => ({
    id: product.id,
    name: product.name,
    priceLabel: product.priceLabel,
    imageUrl: product.imageUrl,
    category: product.category,
  }));

  const availableViews = [
    ...(canCreateSales ? [{ id: 'kasir', label: 'Kasir' }] : []),
    ...(canViewTransactions ? [{ id: 'transaksi', label: 'Transaksi', badge: sales.length }] : []),
    ...((canManageOrders || business.orders.length) ? [{ id: 'pesanan', label: 'Pesanan', badge: business.orders.length }] : []),
  ];
  const requested = query.view;
  const activeView = availableViews.some(item => item.id === requested)
    ? requested!
    : availableViews[0]?.id ?? 'kasir';
  const tabs = availableViews.map(item => ({
    ...item,
    href: `/businesses/${business.id}/orders?view=${item.id}`,
  }));

  const newOrders = business.orders.filter(order => order.status === 'baru').length;
  const processingOrders = business.orders.filter(order => order.status === 'diproses' || order.status === 'siap kirim').length;
  const completedOrders = business.orders.filter(order => order.status === 'selesai').length;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="orders">
      <PageHeader
        eyebrow="Jualan"
        title={activeView === 'kasir' ? 'Kasir' : activeView === 'transaksi' ? 'Transaksi' : 'Pesanan'}
        description={activeView === 'kasir' ? 'Tap produk, atur jumlah, lalu Bayar.' : activeView === 'transaksi' ? 'Riwayat penjualan yang sudah tercatat.' : 'Pantau pesanan yang perlu diproses.'}
      />

      <WorkspaceTabs items={tabs} activeId={activeView} ariaLabel="Mode jualan" />

      {activeView === 'kasir' && canCreateSales ? (
        <div className="space-y-3">
          {canCloseCashShift ? <CashShiftWorkspace businessId={business.id} initialShift={currentShift} /> : null}
          <QuickSaleWorkspace businessId={business.id} products={saleProducts} defaultDate={jakartaDateKey()} />
        </div>
      ) : null}

      {activeView === 'transaksi' && canViewTransactions ? (
        <section className="merchant-list border border-portal-line/80">
          {sales.length ? sales.map(({ sale, lines }) => {
            const itemSummary = lines.map(line => `${line.product_name} × ${Number(line.quantity).toLocaleString('id-ID')}`).join(', ');
            const grossProfit = sale.cost_complete && sale.cogs_amount !== null ? sale.final_amount - sale.cogs_amount : null;
            return (
              <article key={sale.id} className="merchant-action-row sm:grid sm:grid-cols-[minmax(0,1fr)_130px_150px] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-portal-ink">{itemSummary}</p>
                  <p className="mt-1 text-[11px] text-portal-soft">{sale.occurred_on} · {sale.channel_key || 'Langsung'} · {sale.account_key}</p>
                </div>
                <div className="text-right"><p className="text-[10px] font-semibold text-portal-soft">Total</p><p className="text-sm font-black text-portal-ink">{money.format(sale.final_amount)}</p></div>
                <div className="hidden text-right sm:block"><p className="text-[10px] font-semibold text-portal-soft">{canViewCosting ? 'Laba kotor' : 'Biaya'}</p><p className="text-sm font-bold text-portal-ink">{canViewCosting ? (grossProfit === null ? 'HPP belum lengkap' : money.format(grossProfit)) : (sale.cost_complete ? 'Lengkap' : 'Belum lengkap')}</p></div>
              </article>
            );
          }) : <EmptyState title="Belum ada transaksi" description="Penjualan dari Kasir akan muncul di sini." icon={ShoppingBag} />}
        </section>
      ) : null}

      {activeView === 'pesanan' ? (
        <div className="space-y-3">
          <MetricStrip items={[
            { label: 'Baru', value: newOrders, note: 'Belum diproses' },
            { label: 'Berjalan', value: processingOrders, note: 'Diproses / siap kirim' },
            { label: 'Selesai', value: completedOrders, note: 'Sudah ditutup' },
            { label: 'Akses', value: canManageOrders ? 'Kelola' : 'Pantau', note: 'Pesanan kanal' },
          ]} />
          <section className="merchant-list border border-portal-line/80">
            {business.orders.length ? business.orders.map(order => (
              <article key={order.id} className="merchant-action-row sm:grid sm:grid-cols-[minmax(0,.8fr)_minmax(0,1.5fr)_120px_auto] sm:items-center">
                <div className="min-w-0"><p className="truncate text-sm font-black text-portal-ink">{order.buyer}</p><p className="mt-0.5 text-[11px] text-portal-soft">{order.channel} · {order.id}</p></div>
                <p className="min-w-0 truncate text-sm text-portal-ink">{order.itemSummary}</p>
                <strong className="text-sm text-portal-ink">{order.amountLabel}</strong>
                <StatusBadge tone={orderTone(order.status)}>{order.status}</StatusBadge>
              </article>
            )) : <EmptyState title="Belum ada pesanan" description="Pesanan dari kanal online akan muncul di sini." icon={Clock3} />}
          </section>
        </div>
      ) : null}
    </PortalShell>
  );
}
