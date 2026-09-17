import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, PackagePlus, TriangleAlert } from 'lucide-react';
import { IngredientWorkspaceV2 } from '@/components/business-control/IngredientWorkspaceV2';
import { StockPurchaseYieldWorkspace } from '@/components/business-control/StockPurchaseYieldWorkspace';
import { EmptyState } from '@/components/portal/EmptyState';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { ProductThumb } from '@/components/portal/ProductThumb';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { WorkspaceTabs } from '@/components/portal/WorkspaceTabs';
import { listWave2YieldObservations } from '@/lib/business-wave2-server';
import { listControlIngredients } from '@/lib/business-control-server';
import {
  resolveInventoryTab,
  sortStockAttentionFirst,
  type InventoryTab,
} from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
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

const inventoryLabels: Record<InventoryTab, { eyebrow: string; title: string; description: string }> = {
  stock: {
    eyebrow: 'Stok',
    title: 'Stok produk',
    description: 'Barang habis, tipis, atau belum cocok jumlahnya tetap tampil paling atas.',
  },
  purchase: {
    eyebrow: 'Belanja',
    title: 'Belanja & hasil',
    description: 'Catat bahan yang dibeli dan hasil bersih yang benar-benar diterima tanpa mencampurnya dengan daftar stok.',
  },
  ingredients: {
    eyebrow: 'Bahan',
    title: 'Bahan & kemasan',
    description: 'Atur harga beli, satuan, stok minimum, supplier, dan data yang dipakai untuk HPP.',
  },
};

export default async function BusinessInventoryPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const query = await searchParams;
  const requestedTab = resolveInventoryTab(query?.tab);
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewInventory');
  const canViewIngredientCosts = hasPermission(business, 'viewCosting');
  const canManageIngredients = hasPermission(business, 'manageInventory') || hasPermission(business, 'manageCosting');
  const activeTab: InventoryTab = requestedTab !== 'stock' && !canViewIngredientCosts ? 'stock' : requestedTab;

  const needsIngredients = canViewIngredientCosts && (activeTab === 'purchase' || activeTab === 'ingredients');
  const ingredients = needsIngredients ? await listControlIngredients(business.id) : [];
  const observations = canViewIngredientCosts && activeTab === 'purchase'
    ? await listWave2YieldObservations(business.id)
    : [];

  const sortedProducts = sortStockAttentionFirst(business.products);
  const attention = sortedProducts.filter(item => item.stockHealth && item.stockHealth !== 'aman');
  const lowIngredients = ingredients.filter(item => {
    const minimum = Number(item.minimum_stock ?? 0);
    const stock = Number(item.stock_quantity ?? 0);
    return minimum > 0 && Number.isFinite(stock) && stock <= minimum;
  });
  const primaryLocation = business.locations?.find(location => location.isPrimary) ?? business.locations?.[0] ?? null;
  const copy = inventoryLabels[activeTab];

  const tabs = [
    { id: 'stock', label: 'Stok produk', badge: attention.length, href: `/businesses/${business.id}/inventory?tab=stock` },
    ...(canViewIngredientCosts
      ? [
          { id: 'purchase', label: 'Belanja & hasil', href: `/businesses/${business.id}/inventory?tab=purchase` },
          { id: 'ingredients', label: 'Bahan & kemasan', badge: ingredients.length || undefined, href: `/businesses/${business.id}/inventory?tab=ingredients` },
        ]
      : []),
  ];

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="inventory">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      {canView ? (
        <>
          <WorkspaceTabs items={tabs} activeId={activeTab} ariaLabel="Bagian inventori" />

          {activeTab === 'stock' ? (
            <div className="space-y-3">
              <section className="grid gap-2 sm:grid-cols-3">
                <div className="merchant-surface-bordered p-4">
                  <TriangleAlert className="h-4 w-4 text-portal-forest" />
                  <p className="mt-2 text-2xl font-black text-portal-ink">{attention.length}</p>
                  <p className="mt-1 text-xs text-portal-soft">Perlu dicek</p>
                </div>
                <div className="merchant-surface-bordered p-4">
                  <Boxes className="h-4 w-4 text-portal-forest" />
                  <p className="mt-2 text-2xl font-black text-portal-ink">{business.products.length}</p>
                  <p className="mt-1 text-xs text-portal-soft">Produk tercatat</p>
                </div>
                <div className="merchant-surface-bordered p-4">
                  <PackagePlus className="h-4 w-4 text-portal-forest" />
                  <p className="mt-2 text-sm font-black text-portal-ink">
                    {attention.length ? 'Prioritaskan stok yang perlu tindakan' : 'Tidak ada peringatan stok'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-portal-soft">Jumlah stok tetap berdasarkan data yang benar-benar tercatat.</p>
                </div>
              </section>

              <section className="merchant-list border border-portal-line/80">
                {sortedProducts.length ? sortedProducts.map(product => (
                  <article key={product.id} className="merchant-action-row">
                    <ProductThumb name={product.name} imageUrl={product.imageUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-portal-ink">{product.name}</p>
                      <p className="mt-0.5 text-[11px] text-portal-soft">{product.stockLabel} {product.stockUnit ?? 'pcs'}</p>
                    </div>
                    <StatusBadge tone={stockTone(product.stockHealth)}>{stockLabel(product.stockHealth)}</StatusBadge>
                    <Link href={`/businesses/${business.id}/products`} className="portal-button-ghost hidden sm:inline-flex">Lihat</Link>
                  </article>
                )) : (
                  <EmptyState title="Belum ada produk" description="Tambahkan produk dulu agar stok bisa dipantau." icon={Boxes} />
                )}
              </section>
            </div>
          ) : null}

          {activeTab === 'purchase' && canViewIngredientCosts ? (
            <StockPurchaseYieldWorkspace
              businessId={business.id}
              ingredients={ingredients.map(item => ({ id: item.id, name: item.name, purchase_unit: item.purchase_unit }))}
              products={business.products.map(product => ({ id: product.id, name: product.name }))}
              observations={observations}
              canManage={canManageIngredients}
            />
          ) : null}

          {activeTab === 'ingredients' && canViewIngredientCosts ? (
            <div className="space-y-3">
              <section className="grid gap-2 sm:grid-cols-3">
                <div className="merchant-surface-bordered p-4">
                  <TriangleAlert className="h-4 w-4 text-portal-forest" />
                  <p className="mt-2 text-2xl font-black text-portal-ink">{lowIngredients.length}</p>
                  <p className="mt-1 text-xs text-portal-soft">Bahan perlu perhatian</p>
                </div>
                <div className="merchant-surface-bordered p-4">
                  <PackagePlus className="h-4 w-4 text-portal-forest" />
                  <p className="mt-2 text-2xl font-black text-portal-ink">{ingredients.length}</p>
                  <p className="mt-1 text-xs text-portal-soft">Bahan tercatat</p>
                </div>
                <div className="merchant-surface-bordered p-4">
                  <Boxes className="h-4 w-4 text-portal-forest" />
                  <p className="mt-2 text-sm font-black text-portal-ink">HPP tetap opsional</p>
                  <p className="mt-1 text-xs leading-5 text-portal-soft">Mulai sederhana, isi detail biaya saat usaha memang membutuhkannya.</p>
                </div>
              </section>

              <IngredientWorkspaceV2
                businessId={business.id}
                initialIngredients={ingredients}
                primaryLocationId={primaryLocation?.id ?? null}
                primaryLocationName={primaryLocation?.name ?? null}
                canManage={canManageIngredients}
              />

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
