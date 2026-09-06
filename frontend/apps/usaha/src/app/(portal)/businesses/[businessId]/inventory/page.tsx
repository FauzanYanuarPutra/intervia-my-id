import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, PackagePlus, ShoppingCart, TriangleAlert } from 'lucide-react';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessInventoryPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewInventory');
  const attention = business.products.filter(item => item.stockHealth && item.stockHealth !== 'aman');

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="inventory">
      <SectionCard eyebrow="Stok & Belanja" title="Tahu apa yang harus dibeli sebelum habis" description="Mulai dari stok produk yang sudah ada. Berikutnya bahan baku dan kemasan akan terhubung ke resep supaya Lajukan bisa menghitung berapa porsi yang masih bisa dibuat.">
        {canView ? (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Boxes className="h-4 w-4" /></div><p className="mt-3 text-2xl font-bold text-portal-ink">{business.products.length}</p><p className="mt-1 text-xs text-portal-soft">Produk tercatat</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><TriangleAlert className="h-4 w-4" /></div><p className="mt-3 text-2xl font-bold text-portal-ink">{attention.length}</p><p className="mt-1 text-xs text-portal-soft">Perlu perhatian stok</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><ShoppingCart className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Belanja berbasis kebutuhan</p><p className="mt-1 text-xs leading-5 text-portal-soft">Target flow: bahan rendah → daftar belanja → pembelian → harga bahan memperbarui costing berikutnya.</p></div>
            </section>

            <div className="portal-panel overflow-hidden">
              <div className="border-b border-portal-line p-4 sm:p-5"><h2 className="font-bold text-portal-ink">Kondisi stok sekarang</h2><p className="mt-1 text-sm text-portal-soft">Stok finished-product yang sudah tersedia di backend canonical.</p></div>
              <div className="divide-y divide-portal-line">
                {business.products.length ? business.products.map(product => (
                  <div key={product.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div><p className="font-bold text-portal-ink">{product.name}</p><p className="mt-1 text-xs text-portal-soft">{product.stockLabel} · {product.stockUnit ?? 'pcs'}</p></div>
                    <StatusBadge tone={product.stockHealth === 'habis' ? 'danger' : product.stockHealth === 'aman' ? 'success' : 'warning'}>{product.stockHealth === 'habis' ? 'Habis' : product.stockHealth === 'tipis' ? 'Tipis' : product.stockHealth === 'perlu-cocokkan' ? 'Cocokkan stok' : 'Aman'}</StatusBadge>
                  </div>
                )) : <div className="p-5 text-sm text-portal-soft">Belum ada produk. Tambahkan produk terlebih dahulu.</div>}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="portal-panel p-4 sm:p-5"><div className="flex gap-3"><PackagePlus className="mt-1 h-5 w-5 shrink-0 text-portal-forest" /><div><h3 className="font-bold text-portal-ink">Bahan & kemasan berikutnya</h3><p className="mt-1 text-sm leading-6 text-portal-soft">Alpukat, gula, SKM, es, cup, seal, sedotan, dan bahan lain akan punya stok serta harga beli sendiri. Satu penjualan dapat mengurangi stok berdasarkan resep.</p></div></div></div>
              <div className="portal-panel p-4 sm:p-5"><p className="font-bold text-portal-ink">Mau lihat kemampuan produksi?</p><p className="mt-1 text-sm leading-6 text-portal-soft">Gunakan kalkulator HPP untuk memasukkan stok bahan dan melihat bahan pembatas.</p><Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-primary mt-4">Buka HPP & kapasitas</Link></div>
            </div>
          </div>
        ) : <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat stok usaha.</div>}
      </SectionCard>
    </PortalShell>
  );
}
