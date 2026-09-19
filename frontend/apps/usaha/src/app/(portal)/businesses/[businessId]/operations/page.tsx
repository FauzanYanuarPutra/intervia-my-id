import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock3, PackageSearch, Store } from 'lucide-react';
import { OperationsQuickForm } from '@/components/forms/OperationsQuickForm';
import { EmptyState } from '@/components/portal/EmptyState';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { ProductThumb } from '@/components/portal/ProductThumb';
import { StatusBadge } from '@/components/portal/StatusBadge';
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
      <PageHeader eyebrow="Kelola usaha" title="Jam & operasional" description="Atur buka, tutup, dan jam usaha." />

      <MetricStrip items={[
        { label: 'Status usaha', value: business.isOpen ? 'Buka' : 'Tutup' },
        { label: 'Jam operasional', value: business.schedule },
        { label: 'Stok perlu dicek', value: flaggedProducts.length },
      ]} />

      <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="merchant-surface-bordered p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3"><span className="portal-icon-tile"><Clock3 className="h-4 w-4" /></span><div><h2 className="font-black text-portal-ink">Operasional</h2><p className="text-xs text-portal-soft">Status dan jam buka</p></div></div>
          {canManage ? <OperationsQuickForm business={business} /> : (
            <div className="space-y-2">
              <div className="merchant-action-row rounded-xl border border-portal-line"><span className="text-sm text-portal-soft">Status</span><StatusBadge tone={business.isOpen ? 'success' : 'neutral'}>{business.isOpen ? 'Buka' : 'Tutup'}</StatusBadge></div>
              <div className="merchant-action-row rounded-xl border border-portal-line"><span className="text-sm text-portal-soft">Jam buka</span><strong className="text-sm text-portal-ink">{business.schedule}</strong></div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2.5 flex items-end justify-between gap-3"><div><h2 className="font-black text-portal-ink">Perlu ditangani</h2><p className="text-xs text-portal-soft">Stok yang bisa mengganggu penjualan.</p></div><Link href={`/businesses/${business.id}/inventory`} className="text-xs font-black text-portal-forest">Buka stok</Link></div>
          <section className="merchant-list border border-portal-line/80">
            {flaggedProducts.length ? flaggedProducts.map(product => (
              <article key={product.id} className="merchant-action-row">
                <ProductThumb name={product.name} imageUrl={product.imageUrl} size="md" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-portal-ink">{product.name}</p><p className="mt-0.5 text-[11px] text-portal-soft">{product.stockLabel} {product.stockUnit ?? ''}</p></div>
                <StatusBadge tone={product.stockHealth === 'habis' ? 'danger' : 'warning'}>{product.stockHealth === 'tipis' ? 'Stok tipis' : product.stockHealth === 'habis' ? 'Habis' : 'Perlu dicek'}</StatusBadge>
              </article>
            )) : <EmptyState title="Tidak ada gangguan stok" description="Belum ada produk tipis, habis, atau yang perlu dicocokkan." icon={PackageSearch} />}
          </section>
        </div>
      </section>
    </PortalShell>
  );
}
