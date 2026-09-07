import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, ShoppingCart, TriangleAlert } from 'lucide-react';
import { IngredientWorkspace } from '@/components/business-control/IngredientWorkspace';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { listControlIngredients } from '@/lib/business-control-server';
import { sortStockAttentionFirst } from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessInventoryPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewInventory');
  const canViewIngredientCosts = hasPermission(business, 'viewCosting');
  const ingredients = canViewIngredientCosts ? await listControlIngredients(business.id) : [];
  const sortedProducts = sortStockAttentionFirst(business.products);
  const attention = sortedProducts.filter(item => item.stockHealth && item.stockHealth !== 'aman');

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="inventory">
      <SectionCard eyebrow="Stok & Belanja" title="Tangani stok yang paling mendesak dulu" description="Produk habis, tipis, atau belum pasti tampil lebih dulu. Harga beli bahan, supplier, HPP, dan detail resep tetap hanya untuk peran yang memang boleh melihat costing.">
        {canView ? (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><TriangleAlert className="h-4 w-4" /></div><p className="mt-3 text-2xl font-bold text-portal-ink">{attention.length}</p><p className="mt-1 text-xs text-portal-soft">Perlu ditangani</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Boxes className="h-4 w-4" /></div><p className="mt-3 text-2xl font-bold text-portal-ink">{business.products.length}</p><p className="mt-1 text-xs text-portal-soft">Produk tercatat</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><ShoppingCart className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">{attention.length ? 'Cek & restock sekarang' : 'Stok produk tidak menunjukkan alarm'}</p><p className="mt-1 text-xs leading-5 text-portal-soft">Urutan berasal dari kondisi stok yang tercatat, bukan perkiraan Lajukan.</p></div>
            </section>

            <section className="portal-panel overflow-hidden">
              <div className="border-b border-portal-line p-4 sm:p-5"><h2 className="font-bold text-portal-ink">Stok produk jadi</h2><p className="mt-1 text-sm text-portal-soft">Habis → tipis → perlu dicocokkan → aman.</p></div>
              <div className="divide-y divide-portal-line">
                {sortedProducts.length ? sortedProducts.map(product => (
                  <div key={product.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div><p className="font-bold text-portal-ink">{product.name}</p><p className="mt-1 text-xs text-portal-soft">{product.stockLabel} · {product.stockUnit ?? 'pcs'}</p></div>
                    <StatusBadge tone={product.stockHealth === 'habis' ? 'danger' : product.stockHealth === 'aman' ? 'success' : 'warning'}>{product.stockHealth === 'habis' ? 'Habis' : product.stockHealth === 'tipis' ? 'Tipis' : product.stockHealth === 'perlu-cocokkan' ? 'Cocokkan stok' : 'Aman'}</StatusBadge>
                  </div>
                )) : <div className="p-5 text-sm text-portal-soft">Belum ada produk. Tambahkan produk terlebih dahulu.</div>}
              </div>
            </section>

            {canViewIngredientCosts ? (
              <details className="portal-panel group">
                <summary className="cursor-pointer list-none p-4 sm:p-5"><span className="font-bold text-portal-ink">Kelola bahan, kemasan & belanja</span><span className="ml-2 text-xs font-semibold text-portal-soft">Costing lanjutan</span></summary>
                <div className="border-t border-portal-line p-3 sm:p-4">
                  <IngredientWorkspace businessId={business.id} initialIngredients={ingredients} />
                </div>
              </details>
            ) : (
              <div className="portal-panel p-4 sm:p-5"><p className="font-bold text-portal-ink">Stok operasional saja</p><p className="mt-1 text-sm leading-6 text-portal-soft">Peranmu dapat melihat stok produk untuk bekerja, tetapi harga beli bahan, supplier, HPP, dan margin tidak dimuat ke halaman ini.</p></div>
            )}

            {canViewIngredientCosts ? <div className="portal-panel p-4 sm:p-5"><p className="font-bold text-portal-ink">Butuh tahu modal dan kapasitas?</p><p className="mt-1 text-sm leading-6 text-portal-soft">Buka resep setelah bahan nyata sudah tercatat.</p><Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-primary mt-4">Atur resep & HPP</Link></div> : null}
          </div>
        ) : <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat stok usaha.</div>}
      </SectionCard>
    </PortalShell>
  );
}
