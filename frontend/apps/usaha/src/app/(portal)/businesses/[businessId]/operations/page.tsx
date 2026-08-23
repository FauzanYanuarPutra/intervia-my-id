import { notFound } from 'next/navigation';
import { Clock3, Gauge, PackageSearch, Store } from 'lucide-react';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { OperationsQuickForm } from '@/components/forms/OperationsQuickForm';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessOperationsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canManage = hasPermission(business, 'manageOperations');
  const flaggedProducts = business.products.filter(product => ['tipis', 'habis', 'perlu-cocokkan'].includes(product.stockHealth ?? ''));

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="operations">
      <SectionCard eyebrow="Operasional" title="Kondisi usaha hari ini" description="Atur status buka, jam operasional, dan selesaikan pengecekan stok yang berpotensi mengganggu penjualan.">
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Status usaha" value={business.isOpen ? 'Buka' : 'Tutup'} icon={Store} note={business.isOpen ? 'Siap menerima aktivitas pelanggan' : 'Status publik belum dibuka'} />
            <StatCard label="Jam operasional" value={business.schedule} icon={Clock3} note="Jadwal yang tersimpan di workspace" />
            <StatCard label="Perlu cek stok" value={flaggedProducts.length} icon={PackageSearch} note={flaggedProducts.length ? 'Selesaikan sebelum jam ramai' : 'Tidak ada pengecekan mendesak'} />
          </section>

          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <DataPanel title={canManage ? 'Atur operasional' : 'Status operasional'} description={canManage ? 'Perubahan di sini memengaruhi kondisi operasional usaha.' : 'Peranmu saat ini hanya dapat memantau status.'}>
              <div className="p-4 sm:p-5">
                {canManage ? (
                  <OperationsQuickForm business={business} />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-[14px] border border-portal-line px-3.5 py-3"><span className="text-sm text-portal-soft">Status</span><StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{business.isOpen ? 'Sedang buka' : 'Belum buka'}</StatusBadge></div>
                    <div className="flex items-center justify-between rounded-[14px] border border-portal-line px-3.5 py-3"><span className="text-sm text-portal-soft">Jam buka</span><strong className="text-sm text-portal-ink">{business.schedule}</strong></div>
                  </div>
                )}
              </div>
            </DataPanel>

            <DataPanel title="Checklist stok" description="Hanya item yang butuh tindakan yang dinaikkan ke daftar ini.">
              {flaggedProducts.length ? (
                <div className="divide-y divide-portal-line">
                  {flaggedProducts.map(product => (
                    <article key={product.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-portal-ink">{product.name}</p><StatusBadge tone={product.stockHealth === 'habis' ? 'danger' : 'warning'}>{product.stockHealth === 'tipis' ? 'Stok tipis' : product.stockHealth === 'habis' ? 'Habis' : 'Perlu cocokkan'}</StatusBadge></div>
                        <p className="mt-1 text-xs leading-5 text-portal-soft">{product.ownerLabel ?? 'Stok usaha'} · {product.stockLabel} · {product.stockMode === 'estimated' ? 'Estimasi' : 'Manual'}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-portal-soft"><Gauge className="h-4 w-4 text-portal-forest" /> {product.stockMode === 'estimated' ? 'Cocokkan stok fisik' : 'Tindak lanjuti restock'}</div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Stok terlihat aman" description="Belum ada produk tipis, habis, atau yang perlu dicocokkan pada data workspace saat ini." icon={PackageSearch} />
              )}
            </DataPanel>
          </div>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
