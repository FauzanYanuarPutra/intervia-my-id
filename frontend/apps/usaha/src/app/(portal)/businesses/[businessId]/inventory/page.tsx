import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, PackagePlus, TriangleAlert } from 'lucide-react';
import { IngredientWorkspace } from '@/components/business-control/IngredientWorkspace';
import { StockPurchaseYieldWorkspace } from '@/components/business-control/StockPurchaseYieldWorkspace';
import { EmptyState } from '@/components/portal/EmptyState';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { ProductThumb } from '@/components/portal/ProductThumb';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { WorkspaceTabs } from '@/components/portal/WorkspaceTabs';
import { listWave2YieldObservations } from '@/lib/business-wave2-server';
import { listControlIngredients } from '@/lib/business-control-server';
import { sortStockAttentionFirst } from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ view?: string }>;
};

function stockTone(stockHealth: string | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (stockHealth === 'habis') return 'danger';
  if (stockHealth === 'aman') return 'success';
  if (stockHealth === 'tipis' || stockHealth === 'perlu-cocokkan') return 'warning';
  return 'neutral';
}

function stockLabel(stockHealth: string | undefined) {
  if (stockHealth === 'habis') return 'Habis';
  if (stockHealth === 'tipis') return 'Stok tipis';
  if (stockHealth === 'perlu-cocokkan') return 'Perlu dicek';
  if (stockHealth === 'aman') return 'Aman';
  return 'Belum dinilai';
}

export default async function BusinessInventoryPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const query = await searchParams;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewInventory');
  const canViewIngredientCosts = hasPermission(business, 'viewCosting');
  const canManageIngredients = hasPermission(business, 'manageInventory') || hasPermission(business, 'manageCosting');
  const [ingredients, observations] = canViewIngredientCosts
    ? await Promise.all([listControlIngredients(business.id), listWave2YieldObservations(business.id)])
    : [[], []];
  const sortedProducts = sortStockAttentionFirst(business.products);
  const attention = sortedProducts.filter(item => item.stockHealth && item.stockHealth !== 'aman');
  const primaryLocation = business.locations?.find(location => location.isPrimary) ?? business.locations?.[0] ?? null;
  const requestedView = query.view;
  const defaultView = attention.length ? 'attention' : 'all';
  const activeView = requestedView === 'materials' && canViewIngredientCosts
    ? 'materials'
    : requestedView === 'all'
      ? 'all'
      : requestedView === 'attention'
        ? 'attention'
        : defaultView;

  const tabs = [
    { id: 'attention', label: 'Perlu tindakan', badge: attention.length, href: `/businesses/${business.id}/inventory?view=attention` },
    { id: 'all', label: 'Semua stok', badge: business.products.length, href: `/businesses/${business.id}/inventory?view=all` },
    ...(canViewIngredientCosts ? [{ id: 'materials', label: 'Bahan', badge: ingredients.length, href: `/businesses/${business.id}/inventory?view=materials` }] : []),
  ];
  const displayedProducts = activeView === 'attention' ? attention : sortedProducts;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="inventory">
      <PageHeader
        eyebrow="Stok"
        title={activeView === 'attention' ? 'Yang perlu dicek' : activeView === 'materials' ? 'Bahan & kemasan' : 'Semua stok'}
        description={activeView === 'attention' ? 'Selesaikan yang habis, tipis, atau belum cocok jumlahnya dulu.' : activeView === 'materials' ? 'Belanja, yield, harga beli, dan stok bahan untuk kebutuhan HPP.' : 'Lihat jumlah stok produk dalam satu daftar sederhana.'}
      />

      {canView ? (
        <>
          <WorkspaceTabs items={tabs} activeId={activeView} ariaLabel="Mode stok" />

          {activeView !== 'materials' ? (
            <section className="merchant-list border border-portal-line/80">
              {displayedProducts.length ? displayedProducts.map(product => (
                <article key={product.id} className="merchant-action-row">
                  <ProductThumb name={product.name} imageUrl={product.imageUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-portal-ink">{product.name}</p>
                    <p className="mt-0.5 text-[11px] text-portal-soft">{product.stockLabel} {product.stockUnit ?? 'pcs'}</p>
                  </div>
                  <StatusBadge tone={stockTone(product.stockHealth)}>{stockLabel(product.stockHealth)}</StatusBadge>
                  <Link href={`/businesses/${business.id}/products`} className="portal-button-ghost hidden sm:inline-flex">Lihat</Link>
                </article>
              )) : activeView === 'attention' ? (
                <EmptyState title="Stok aman" description="Tidak ada produk yang sedang butuh perhatian." icon={Boxes} />
              ) : (
                <EmptyState title="Belum ada produk" description="Tambahkan produk dulu agar stok bisa dipantau." icon={Boxes} />
              )}
            </section>
          ) : null}

          {activeView === 'materials' && canViewIngredientCosts ? (
            <div className="space-y-3">
              <section className="grid gap-2 sm:grid-cols-3">
                <div className="merchant-surface-bordered p-4"><TriangleAlert className="h-4 w-4 text-portal-forest" /><p className="mt-2 text-2xl font-black text-portal-ink">{ingredients.filter(item => item.stock_status === 'low' || item.stock_status === 'out').length}</p><p className="mt-1 text-xs text-portal-soft">Bahan perlu perhatian</p></div>
                <div className="merchant-surface-bordered p-4"><PackagePlus className="h-4 w-4 text-portal-forest" /><p className="mt-2 text-2xl font-black text-portal-ink">{ingredients.length}</p><p className="mt-1 text-xs text-portal-soft">Bahan tercatat</p></div>
                <div className="merchant-surface-bordered p-4"><Boxes className="h-4 w-4 text-portal-forest" /><p className="mt-2 text-sm font-black text-portal-ink">HPP tetap opsional</p><p className="mt-1 text-xs leading-5 text-portal-soft">Kelola bahan hanya saat usaha membutuhkan perhitungan modal lebih rinci.</p></div>
              </section>

              <StockPurchaseYieldWorkspace
                businessId={business.id}
                ingredients={ingredients.map(item => ({ id: item.id, name: item.name, purchase_unit: item.purchase_unit }))}
                products={business.products.map(product => ({ id: product.id, name: product.name }))}
                observations={observations}
                canManage={canManageIngredients}
              />

              <details className="merchant-surface-bordered group">
                <summary className="cursor-pointer list-none p-4 sm:p-5"><span className="font-black text-portal-ink">Detail bahan & kemasan</span><span className="ml-2 text-xs font-semibold text-portal-soft">Harga beli, supplier, stok minimum</span></summary>
                <div className="border-t border-portal-line/70 p-3 sm:p-4">
                  <IngredientWorkspace businessId={business.id} initialIngredients={ingredients} primaryLocationId={primaryLocation?.id ?? null} primaryLocationName={primaryLocation?.name ?? null} canManage={canManageIngredients} />
                </div>
              </details>

              <Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-secondary w-full sm:w-auto">Modal produk (HPP)</Link>
            </div>
          ) : null}
        </>
      ) : (
        <div className="merchant-surface-bordered p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat stok usaha.</div>
      )}
    </PortalShell>
  );
}
