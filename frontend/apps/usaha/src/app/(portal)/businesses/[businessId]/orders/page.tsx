import { notFound } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { CashShiftWorkspace } from '@/components/business-control/CashShiftWorkspace';
import { OrderInboxWorkspace } from '@/components/business-control/OrderInboxWorkspace';
import { QuickSaleWorkspace } from '@/components/business-control/QuickSaleWorkspace';
import { SalesHistoryWorkspace } from '@/components/business-control/SalesHistoryWorkspace';
import { EmptyState } from '@/components/portal/EmptyState';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { WorkspaceTabs } from '@/components/portal/WorkspaceTabs';
import { getCurrentWave2CashShift } from '@/lib/business-wave2-server';
import { listControlChannels, listControlOrders, listControlSales, type ControlSaleLine } from '@/lib/business-control-server';
import { jakartaDateKey } from '@/lib/business-control/insights';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ view?: string }>;
};

type ConfigurationSnapshot = {
  choices?: Array<{ option_label?: string }>;
  note?: string | null;
};

type SnapshotAwareSaleLine = ControlSaleLine & {
  configuration_snapshot?: ConfigurationSnapshot | null;
  line_note?: string | null;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
});

function saleLineConfiguration(line: ControlSaleLine): ConfigurationSnapshot | null {
  const snapshotLine = line as SnapshotAwareSaleLine;
  if (snapshotLine.configuration_snapshot && typeof snapshotLine.configuration_snapshot === 'object') {
    return snapshotLine.configuration_snapshot;
  }
  const configuration = line.cost_snapshot?.configuration;
  return configuration && typeof configuration === 'object'
    ? configuration as ConfigurationSnapshot
    : null;
}

function saleLineChoiceSummary(line: ControlSaleLine) {
  return saleLineConfiguration(line)?.choices
    ?.map(choice => choice.option_label?.trim())
    .filter(Boolean)
    .join(' · ') ?? '';
}

function saleLineNote(line: ControlSaleLine) {
  const snapshotLine = line as SnapshotAwareSaleLine;
  const direct = snapshotLine.line_note?.trim();
  if (direct) return direct;
  return saleLineConfiguration(line)?.note?.trim() || '';
}

export default async function BusinessOrdersPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const query = await searchParams;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canViewOrders = hasPermission(business, 'viewOrders');
  const canManageOrders = hasPermission(business, 'manageOrders');
  const canCreateSales = hasPermission(business, 'createSales');
  const canViewTransactions = hasPermission(business, 'viewTransactions');
  const canCloseCashShift = hasPermission(business, 'closeCashShift');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const canViewChannels = hasPermission(business, 'viewChannels');
  const canVoidSales = hasPermission(business, 'voidSales');
  const [sales, currentShift, canonicalOrders, channels] = await Promise.all([
    canViewTransactions ? listControlSales(business.id) : Promise.resolve([]),
    canCloseCashShift ? getCurrentWave2CashShift(business.id) : Promise.resolve(null),
    canViewOrders ? listControlOrders(business.id) : Promise.resolve([]),
    canCreateSales && canViewChannels ? listControlChannels(business.id) : Promise.resolve([]),
  ]);

  const saleProducts = business.products.filter(product => product.status === 'live').map(product => ({
    id: product.id,
    name: product.name,
    priceLabel: product.priceLabel,
    imageUrl: product.imageUrl,
    category: product.category,
    modifierGroups: product.modifierGroups ?? [],
  }));

  const availableViews = [
    ...(canCreateSales ? [{ id: 'kasir', label: 'Kasir' }] : []),
    ...(canViewTransactions ? [{ id: 'transaksi', label: 'Transaksi', badge: sales.length }] : []),
    ...(canViewOrders ? [{ id: 'pesanan', label: 'Pesanan', badge: canonicalOrders.length }] : []),
  ];
  const requested = query.view;
  const activeView = availableViews.some(item => item.id === requested)
    ? requested!
    : availableViews[0]?.id ?? 'kasir';
  const tabs = availableViews.map(item => ({
    ...item,
    href: `/businesses/${business.id}/orders?view=${item.id}`,
  }));

  const newOrders = canonicalOrders.filter(order => order.order.base_status === 'PAID').length;
  const processingOrders = canonicalOrders.filter(order =>
    ['PROCESSING', 'SHIPPED', 'IN_SERVICE', 'DELIVERED'].includes(order.order.base_status),
  ).length;
  const completedOrders = canonicalOrders.filter(order => order.order.base_status === 'COMPLETED').length;
  const actionOrders = canonicalOrders.filter(order => order.allowed_next_statuses.length > 0).length;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="orders">
      <PageHeader
        eyebrow="Jualan"
        title={activeView === 'kasir' ? 'Kasir' : activeView === 'transaksi' ? 'Transaksi' : 'Pesanan'}
        description={activeView === 'kasir' ? 'Tap produk, cek pesanan di panel, lalu selesaikan pembayaran.' : activeView === 'transaksi' ? 'Riwayat penjualan yang sudah tercatat.' : 'Urutkan pesanan berdasarkan status dan lihat langkah operasional berikutnya.'}
      />

      <WorkspaceTabs items={tabs} activeId={activeView} ariaLabel="Mode jualan" />

      {activeView === 'kasir' && canCreateSales ? (
        <div className="space-y-3">
          {canCloseCashShift ? <CashShiftWorkspace businessId={business.id} initialShift={currentShift} /> : null}
          <QuickSaleWorkspace
            businessId={business.id}
            products={saleProducts}
            channels={channels.filter(channel => channel.enabled).map(channel => ({ value: channel.channel_key, label: channel.display_name }))}
            defaultDate={jakartaDateKey()}
          />
        </div>
      ) : null}

      {activeView === 'transaksi' && canViewTransactions ? (
        <SalesHistoryWorkspace
          businessId={business.id}
          sales={sales}
          canVoidSales={canVoidSales}
          canViewCosting={canViewCosting}
        />
      ) : null}

      {activeView === 'pesanan' ? (
        <div className="space-y-3">
          <MetricStrip items={[
            { label: 'Baru', value: newOrders, note: 'Belum diproses' },
            { label: 'Berjalan', value: processingOrders, note: 'Diproses / siap kirim' },
            { label: 'Selesai', value: completedOrders, note: 'Sudah ditutup' },
            { label: 'Perlu aksi', value: actionOrders, note: canManageOrders ? 'Bisa ditindaklanjuti' : 'Untuk dipantau' },
          ]} />
          <OrderInboxWorkspace
            businessId={business.id}
            orders={canonicalOrders}
            canManageOrders={canManageOrders}
          />
        </div>
      ) : null}
    </PortalShell>
  );
}
