import { notFound } from 'next/navigation';
import { ClipboardCheck, Clock3, PackageCheck, ShoppingBag } from 'lucide-react';
import { QuickSaleWorkspace } from '@/components/business-control/QuickSaleWorkspace';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { listControlSales } from '@/lib/business-control-server';
import { jakartaDateKey } from '@/lib/business-control/insights';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function orderTone(status: string): 'info' | 'warning' | 'success' | 'neutral' {
  if (status === 'baru') return 'info';
  if (status === 'diproses' || status === 'siap kirim') return 'warning';
  if (status === 'selesai') return 'success';
  return 'neutral';
}

export default async function BusinessOrdersPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canManage = hasPermission(business, 'manageOrders');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const sales = canManage ? await listControlSales(business.id) : [];
  const saleProducts = business.products
    .filter(product => product.status === 'live')
    .map(product => ({
      id: product.id,
      name: product.name,
      priceLabel: product.priceLabel,
    }));
  const newOrders = business.orders.filter(order => order.status === 'baru').length;
  const processingOrders = business.orders.filter(
    order => order.status === 'diproses' || order.status === 'siap kirim',
  ).length;
  const completedOrders = business.orders.filter(
    order => order.status === 'selesai',
  ).length;

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="orders"
    >
      <SectionCard
        eyebrow="Penjualan"
        title="Pesanan & penjualan"
        description="Catat penjualan langsung lebih dulu, lalu pantau antrean order dari kanal lain tanpa mencampurkan keduanya."
      >
        <div className="space-y-4">
          {canManage ? (
            <DataPanel
              title="Catat penjualan"
              description="Simpan transaksi nyata. HPP dihitung dari resep aktif dan dikunci sebagai snapshot historis oleh backend."
            >
              <div className="p-3 sm:p-4">
                <QuickSaleWorkspace
                  businessId={business.id}
                  products={saleProducts}
                  defaultDate={jakartaDateKey()}
                />
              </div>
            </DataPanel>
          ) : null}

          <DataPanel
            title="Penjualan tercatat"
            description={`${sales.length} transaksi canonical tersimpan.`}
          >
            {sales.length ? (
              <div className="divide-y divide-portal-line">
                {sales.map(({ sale, lines }) => {
                  const itemSummary = lines
                    .map(
                      line =>
                        `${line.product_name} × ${Number(line.quantity).toLocaleString('id-ID')}`,
                    )
                    .join(', ');
                  const grossProfit =
                    sale.cost_complete && sale.cogs_amount !== null
                      ? sale.final_amount - sale.cogs_amount
                      : null;
                  return (
                    <article
                      key={sale.id}
                      className="grid gap-2 px-4 py-3 sm:grid-cols-[110px_minmax(180px,1fr)_120px_150px] sm:items-center sm:px-5"
                    >
                      <div>
                        <p className="text-[11px] font-semibold text-portal-soft">Tanggal</p>
                        <p className="text-sm font-bold text-portal-ink">{sale.occurred_on}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-portal-ink">{itemSummary}</p>
                        <p className="mt-1 text-xs text-portal-soft">{sale.channel_key || 'Tanpa kanal'} · {sale.account_key}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-portal-soft">Omzet</p>
                        <p className="text-sm font-bold text-portal-ink">{money.format(sale.final_amount)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-portal-soft">{canViewCosting ? 'Laba kotor' : 'Status biaya'}</p>
                        <p className="text-sm font-bold text-portal-ink">
                          {canViewCosting
                            ? grossProfit === null
                              ? 'HPP belum lengkap'
                              : money.format(grossProfit)
                            : sale.cost_complete
                              ? 'Terkunci'
                              : 'Belum lengkap'}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Belum ada penjualan tercatat"
                description="Penjualan yang dibuat dari form di atas akan muncul di sini dengan snapshot HPP historis."
                icon={ShoppingBag}
              />
            )}
          </DataPanel>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Baru masuk" value={newOrders} icon={ShoppingBag} note="Belum mulai diproses" />
            <StatCard label="Sedang berjalan" value={processingOrders} icon={Clock3} note="Diproses atau siap kirim" />
            <StatCard label="Selesai" value={completedOrders} icon={PackageCheck} note="Tercatat pada data workspace" />
            <StatCard label="Akses" value={canManage ? 'Kelola' : 'Pantau'} icon={ClipboardCheck} note={canManage ? 'Dapat memproses pesanan' : 'Mode lihat saja'} />
          </section>

          <DataPanel
            title="Antrean pesanan"
            description={`${business.orders.length} pesanan eksternal/operasional tercatat untuk usaha ini.`}
          >
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
              <EmptyState
                title="Belum ada pesanan"
                description="Begitu pesanan dari kanal order masuk, antreannya tampil di sini terpisah dari penjualan kasir."
                icon={ShoppingBag}
              />
            )}
          </DataPanel>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
