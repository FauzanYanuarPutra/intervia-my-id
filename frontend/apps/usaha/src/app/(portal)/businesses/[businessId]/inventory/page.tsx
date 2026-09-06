import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, ShoppingCart, TriangleAlert } from 'lucide-react';
import { IngredientWorkspace } from '@/components/business-control/IngredientWorkspace';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { listControlIngredients } from '@/lib/business-control-server';
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
  const attention = business.products.filter(item => item.stockHealth && item.stockHealth !== 'aman');

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="inventory">
      <SectionCard eyebrow="Stok & Belanja" title="Tahu apa yang harus dibeli sebelum habis" description="Produk jadi terlihat untuk tim operasional. Detail bahan, harga beli, supplier, dan stok resep hanya dibuka untuk peran yang memang boleh melihat HPP.">
        {canView ? (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Boxes className="h-4 w-4" /></div><p className="mt-3 text-2xl font-bold text-portal-ink">{business.products.length}</p><p className="mt-1 text-xs text-portal-soft">Produk tercatat</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><TriangleAlert className="h-4 w-4" /></div><p className="mt-3 text-2xl font-bold text-portal-ink">{attention.length}</p><p className="mt-1 text-xs text-portal-soft">Produk perlu perhatian stok</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><ShoppingCart className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Belanja berbasis resep</p><p className="mt-1 text-xs leading-5 text-portal-soft">Owner/manager dapat menghubungkan stok bahan dengan HPP tanpa membuka biaya supplier ke kasir/viewer.</p></div>
            </section>

            {canViewIngredientCosts ? (
              <IngredientWorkspace businessId={business.id} initialIngredients={ingredients} />
            ) : (
              <div className="portal-panel p-4 sm:p-5">
                <p className="font-bold text-portal-ink">Stok operasional saja</p>
                <p className="mt-1 text-sm leading-6 text-portal-soft">Peranmu dapat melihat stok produk untuk bekerja, tetapi harga beli bahan, supplier, HPP, dan margin disembunyikan.</p>
              </div>
            )}

            <section className="portal-panel overflow-hidden">
              <div className="border-b border-portal-line p-4 sm:p-5"><h2 className="font-bold text-portal-ink">Stok produk jadi</h2><p className="mt-1 text-sm text-portal-soft">Tersedia untuk usaha yang memang menyimpan finished product.</p></div>
              <div className="divide-y divide-portal-line">
                {business.products.length ? business.products.map(product => (
                  <div key={product.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div><p className="font-bold text-portal-ink">{product.name}</p><p className="mt-1 text-xs text-portal-soft">{product.stockLabel} · {product.stockUnit ?? 'pcs'}</p></div>
                    <StatusBadge tone={product.stockHealth === 'habis' ? 'danger' : product.stockHealth === 'aman' ? 'success' : 'warning'}>{product.stockHealth === 'habis' ? 'Habis' : product.stockHealth === 'tipis' ? 'Tipis' : product.stockHealth === 'perlu-cocokkan' ? 'Cocokkan stok' : 'Aman'}</StatusBadge>
                  </div>
                )) : <div className="p-5 text-sm text-portal-soft">Belum ada produk. Tambahkan produk terlebih dahulu.</div>}
              </div>
            </section>

            {canViewIngredientCosts ? <div className="portal-panel p-4 sm:p-5"><p className="font-bold text-portal-ink">Sudah isi bahan?</p><p className="mt-1 text-sm leading-6 text-portal-soft">Susun resep untuk melihat HPP dan bahan yang membatasi produksi.</p><Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-primary mt-4">Buka HPP & kapasitas</Link></div> : null}
          </div>
        ) : <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat stok usaha.</div>}
      </SectionCard>
    </PortalShell>
  );
}
